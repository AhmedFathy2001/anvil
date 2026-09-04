import type { PartialGuideDict } from './en';

// 简体中文 — Simplified Chinese.
//
// 与此处其他语言文件相同的约定：读者在屏幕上「真正看到」的东西一律保留英文 —— RuneLite 与 OBS 的菜单、
// 插件本身输出的聊天行，以及 Anvil 管理界面的标签（在该界面本身被翻译之前都是英文）。把
// "Tracked drop detected" 翻译掉，就等于让人再也搜不到那一行。其余的一切 —— 解释、顺序、原因 —— 都是中文。

const zhHans: PartialGuideDict = {
  common: {
    contents: '目录',
    step: '步骤',
    optional: '可选',
    minRead: '阅读约 {n} 分钟',
    language: '语言',
    partialNotice:
      '本指南只有部分内容译成了{language}。尚未翻译的部分以英文显示。',
    backToGuides: '全部指南',
    unreviewedNotice:
      '这份{language}译文还没有母语者校对过。如果某句话读起来不对，[英文页面]({englishHref}) 才是原文 —— 而[告诉我们](/feedback)才能让它被修正。',
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
    },
    cards: {
      plugin: {
        eyebrow: '面向玩家',
        title: 'RuneLite 插件设置',
        blurb:
          '安装插件，把它连到本站，让它替你提交掉落。同时涵盖 Discord 通知与 OBS 片段。',
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
    },
  },

  plugin: {
    metaTitle: 'RuneLite 插件设置 — Anvil',
    metaDescription:
      '安装 Anvil 的 RuneLite 插件，把它连到本站，并设置 Discord 通知与 OBS 片段。',
    eyebrow: 'Anvil · RuneLite 插件',
    title: '玩家设置指南',
    dek: '装好它，把它指向 {clanName}，然后照常玩。插件会提交你的宾果掉落，把稀有掉落和死亡发到 Discord —— 如果你在跑 OBS，还会把值得回看的瞬间保存成片段并发出去。',
    facts: [
      { strong: '两个字段', rest: '就能开始记录' },
      { strong: '约 3 分钟', rest: '完成基础设置' },
      { strong: '片段功能', rest: '需要 OBS 再加 5 分钟' },
    ],
    footnote:
      '截图取自真实的设置环境 —— 账号令牌、OBS 地址和 Discord webhook 都是刻意打码的。你自己的这些也应当同样保密。',

    install: {
      title: '安装插件',
      body: [
        '在 RuneLite 中：**Configuration**（扳手图标）→ **Plugin Hub** → 搜索 **Anvil** → **Install**。发布者是 `AhmedFathy2001`。',
        '一个插件服务所有氏族 —— 下一步你会把它指向本站，所以没有任何与氏族相关的东西需要额外下载。装好之后，打开 **Configuration → Anvil** 即可进入本指南全程使用的设置面板。',
      ],
    },

    connect: {
      title: '连接到本站',
      intro: '想跑起来，只有 **Setup** 这一节重要。其余各项都有合理的默认值。',
      figure: {
        caption: 'Configuration → Anvil → Setup',
        alt: 'Anvil 插件的 Setup 区块，Site URL 与 Account Token 两个字段被方框标出',
        legend: [
          {
            label: 'Site URL',
            body: '对 {clanName} 来说是 `{origin}`。这个字段初始为空，必须你自己填。结尾不需要斜杠，若省略 `https://` 会自动补上。',
          },
          {
            label: 'Account Token',
            body: '你访问本站的个人密钥。要么让插件替你填（见下），要么自己粘贴。请把它当作密码对待。',
          },
        ],
      },
      easyHeading: '简单办法：直接在插件里登录',
      easyIntro:
        '当 Site URL 已填、令牌仍为空时，**Anvil 侧边栏**会出现一个 **Sign in with Discord** 按钮。点它，插件会一步步带你走完 —— 什么都不用复制。',
      easySteps: [
        '面板会显示一段代码，并在本站打开你的浏览器。',
        '核对网页上的代码与 RuneLite 中显示的一致，然后点 **Approve**。',
        '面板会显示 _Signed in_，并替你把 Account Token 填好。',
      ],
      linkFigure: {
        caption: '本站 → /link-device',
        alt: 'Link your RuneLite client 页面，代码字段与 Approve 按钮被方框标出',
        legend: [
          { label: '那段代码', body: '它必须与插件此刻显示给你的完全一致。' },
          {
            label: 'Approve',
            body: '只批准_你自己_的客户端正在显示的代码。若有人给你发来链接或代码，请拒绝 —— 批准就等于把账号交给对方。',
          },
        ],
      },
      brokeredNote: {
        tag: '为什么会出现第二个域名',
        body: [
          '批准这一步发生在这里，也就是 `{origin}`。如果你还没登录本站，登录环节会经由 Anvil 在 `anvilosrs.com` 上的共享 Discord 登录来确认你的 Discord 身份，随后直接把你送回这里 —— 那和本站 Login 按钮给你的是同一套登录，并不属于插件流程。',
          '插件本身只和 `{origin}` 通信：它拒绝打开任何不在你所填 Site URL 上的登录页面。',
        ],
      },
      directNote: {
        tag: '这一切发生在哪里',
        body: [
          '整个流程都留在 `{origin}` —— 代码在这里签发、在这里用 {clanName} 自己的 Discord 登录批准、令牌也在这里交回。插件拒绝打开任何不在你所填 Site URL 上的登录页面，因此这一步不会触及另一套 Anvil 部署。',
        ],
      },
      federationAside:
        '别把它和侧边栏里的 **Connect clans** 弄混 —— 那是另一个可选按钮，用来把你连到其他 Anvil 氏族，而且只有在你已经登录之后才会出现。',
      manualFallback:
        '如果浏览器没有自动打开，面板会把网址和代码打印出来，你可以手动打开。代码十分钟后失效 —— 再按一次按钮即可。',
      manualHeading: '手动办法：复制你的令牌',
      manualIntro:
        '用 Discord 登录并打开 [Profile](/profile)，然后向下找到 **RuneLite plugin** 卡片。',
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
            body: '把它复制到插件的 Account Token 字段。Rotate 会签发一个新的并作废旧的 —— 只要你怀疑令牌外泄就用它。',
          },
        ],
      },
      goodToKnow: {
        tag: '值得一提',
        body: ['一个令牌涵盖你在此报名的所有活动 —— 不需要每场宾果都重新粘贴一次。'],
      },
    },

    accounts: {
      title: '关联你的账号 —— 照常玩就行',
      body: [
        '没有需要输入的关联码。令牌填好之后，你登录的任何账号都会自动匹配到你的个人资料上。',
        '插件每次请求都会带上你的游戏内名字以及一枚稳定的账号指纹，而本站优先按指纹匹配 —— 所以改名之后关联依然有效。用小号登录一次，它就会出现在你的个人资料中 _Accounts we noticed you playing_ 一栏，旁边有一键 **Add**。',
      ],
      figure: {
        caption: 'Profile → RuneScape Accounts',
        alt: '个人资料页上的 RuneScape Accounts 卡片，列出通过插件验证的账号',
        legend: [
          {
            label: '你已关联的账号',
            body: '凡是标着 “Verified via plugin” 的，都只是因为被玩过才出现在那里。想加多少小号都行；其中一个是你的主号。',
          },
        ],
      },
      noPluginHeading: '没法运行插件？',
      noPluginIntro:
        '在手机或官方客户端上，改为在网站上关联账号 —— 个人资料页会同时给出两个选项：',
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
        '你还会看到 **Anvil 侧边栏**填入你的氏族、正在进行的活动、你的名次以及同步按钮，并且游戏内 Collection Log 的标题栏上会出现一个 **Anvil** 按钮，就在 WikiSync 和 RuneProfile 旁边。',
      guestNote: {
        tag: '访客与成员之别',
        body: '如果聊天里显示 _Tracked as a guest_，说明你已被记录，但还没进入氏族成员名单。管理员同步一次游戏内成员名单即可解决 —— 去{discordLink}问一声。',
        discordWord: 'Discord 里',
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
            label: 'Auto Submit Drops',
            body: '在被追踪的掉落落地的那一刻自动截图并提交。保持开启；整件事的重点就在这里。',
          },
          {
            label: 'Show Overlay',
            body: '在左上角画一个小小的 _Anvil / 队伍 / UTC 日期_ 面板。它会成为凭证截图画面的一部分，而正是这一点让凭证难以伪造或倒填日期。这张截图里它是关的 —— 如果你的氏族希望每张凭证上都能看到队伍和时间，就打开它。',
          },
          {
            label: 'Team completion popups',
            body: '队里任何人完成一个格子时弹出横幅。若同时完成多个：最难的那个用横幅，其余进聊天框。',
          },
          {
            label: 'Distinct mission sound',
            body: '让任务掉落时、以及有人认领时发出各自的提示音，不用看屏幕也能和普通格子完成区分开。',
          },
          {
            label: 'Banner sound + volume',
            body: '在横幅出现时播放声音。在你自己通过 Anvil 侧边栏“Banner sounds”下的 **Add clip** 添加至少一个 .wav 之前，不会有任何声音。',
          },
          {
            label: 'Two-frame drop proof',
            body: '几秒之后、等掉落物落定在地上时，再把第二帧合进截图。保持开启；能省下不少争论。',
          },
        ],
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
        '无论是否有宾果在进行，这些都会发出，并且发到氏族的频道里。发到哪个频道由管理员在这里决定 —— 你只选择_发什么_。',
      dropsFigure: {
        caption: 'Deaths & kills · Drops & pets',
        alt: 'Deaths and kills 与 Drops and pets 两个通知区块，每一项设置都被方框标出并编号',
        legend: [
          {
            label: 'Notify on death',
            body: '发到氏族的死亡频道，并附上你死亡那一刻的截图。',
          },
          { label: 'Death message', body: '你自己的那句话。`{name}` 会被替换成你的 RSN。' },
          {
            label: 'Notify on PvP kill',
            body: '目标血量归零那一 tick 的截图。默认关闭；这里是开的。',
          },
          { label: 'Notify on rare drops', body: '掉落播报的总开关。' },
          {
            label: 'Min drop value / Min drop rarity',
            body: '两条相互独立的触发路径：价值至少达到这个数（GE 价与 high alch 取高者），或者稀有度高于 N 分之一（默认 1/10,000 —— 阈值放得太松，频道会被草药类掉落刷屏）。你的氏族可以设一个对所有人生效的稀有度下限；当你自己的更严格时依然以你的为准。把其中任一项设为 0 即可关闭该路径。',
          },
          { label: 'Screenshot rare drops', body: '附上图片，而不只是文字。' },
          {
            label: 'Loot key value',
            body: '当一把 loot key 的全部内容超过这个数值时，作为单条通知一次性发出。',
          },
          { label: 'Notify on pets + Screenshot pets', body: '宠物发到稀有掉落频道。' },
        ],
      },
      caFigure: {
        caption: 'Combat achievements · levels · diaries · quests',
        alt: 'Combat achievements 通知区块，每一项设置都被方框标出并编号',
        legend: [
          { label: 'Notify on combat achievements', body: '只要此项开启，完成整个层级时一定会播报。' },
          {
            label: 'CA task min tier',
            body: '单个任务完成的播报有多吵。这里选的是 Elite；默认是 Master。想只留最稀有的就设成 Grandmaster。',
          },
          {
            label: 'Notify on 99s & high totals',
            body: '99 级、从 1800 起每 100 总等级，以及满级。',
          },
          { label: 'Notify on diary completions', body: '成就日记的各个层级。' },
          {
            label: 'Announce quest completions',
            body: '从你选定的难度往上播报。这里是 “All quests”；默认是 Master 及以上。',
          },
        ],
      },
    },

    clips: {
      title: '用 OBS 录制片段',
      intro: [
        '按一个键，最近 30 秒就会被保存并丢进氏族的片段频道。默认关闭，并且需要 OBS 在运行 —— 但这是你的氏族能拥有的、最接近精彩集锦的东西。',
        '原理是这样的：OBS 会持续保留最近 X 秒的**回放缓冲（replay buffer）**。你的快捷键让 OBS 把这段缓冲写成文件，插件再取走该文件，上传到你粘贴进来的 Discord webhook。',
      ],
      privacyNote: {
        tag: '你的视频去了哪里',
        body: '片段是**从你的电脑直接上传到 Discord** 的。它们从不经过本站；如果你把 webhook 字段留空，就完全不会有任何上传 —— 片段只会留在你自己的机器上。',
      },
      obsHeading: 'A. 配置 OBS（只需一次）',
      obsSteps: [
        '你需要 **OBS Studio 28 或更新版本** —— 从 28 起 WebSocket 服务器已内置，无需额外下载。',
        '确认 OBS 确实在捕获游戏画面：需要一个显示 RuneLite 的 Game / Window / Display Capture 源。如果 OBS 看不到你的客户端，你的片段就会是一块黑色矩形。',
        '**Settings → Output** → 勾选 **Enable Replay Buffer**。（Simple 输出模式下它在 Recording 页；Advanced 模式下它有自己的标签页。）顺手确认录制路径还有空间。',
        '**Tools → WebSocket Server Settings** → 勾选 **Enable WebSocket server**。记下 **Server Port**（默认 4455），并点 **Show Connect Info** 获取密码。',
      ],
      obsAside:
        '你_不需要_去按 “Start Replay Buffer” —— 插件连接成功时会替你启动它，并在你更改片段时长时自动重启。',
      fillHeading: 'B. 填写插件设置',
      figure: {
        caption: 'Configuration → Anvil → Clips',
        alt: '插件设置中的 Clips 区块，每一项设置都被方框标出并编号；OBS 主机与 webhook 网址已隐藏',
        legend: [
          { label: 'Enable clip capture', body: '总开关。关闭时插件根本不会和 OBS 通信。' },
          {
            label: 'Capture clip hotkey',
            body: '一定要设，否则永远不会有任何反应。挑一个你在团本中途不会误按的键。',
          },
          {
            label: 'OBS host / port / password',
            body: 'OBS 与 RuneLite 在同一台电脑上时填 `localhost`。若 OBS 在另一台机器上，这里填那台机器的局域网 IP —— 本截图中已隐藏 —— 并在它的防火墙上放行该端口。端口和密码来自 _Show Connect Info_；如果你关掉了 OBS 的身份验证，密码留空即可。',
          },
          {
            label: 'Max auto-post size (MB)',
            body: '超过这个大小的片段只会本地保存，并在聊天里低调提一句，而不会发出去。请按你的 Discord 服务器实际能接受的大小来设；插件出厂值是 25。',
          },
          {
            label: 'Clip length (seconds)',
            body: '每个片段往回覆盖多久。这会把缓冲时长写进你的 OBS 配置，因此 OBS 需要积累这么多秒之后，完整长度的片段才存在。片段越长文件越大；30 是个不错的折中。',
          },
          {
            label: 'Save clips as MP4',
            body: 'MP4 在 Discord 中可直接预览和播放；MKV 必须先下载。注意这会改变 OBS 的录制格式，也会影响你平时的录像。想让 OBS 保持原样就关掉它。',
          },
          {
            label: 'Clips Discord webhook URL',
            body: '片段发到哪里 —— 向管理员索取片段频道的 webhook。留空 = 片段留在你的电脑上。这里隐藏了，而且确实值得隐藏：任何拿到这个网址的人都能往那个频道发东西。',
          },
          {
            label: 'Post OBS-triggered clips too',
            body: '同时处理由 OBS 自身或 “Save Replay Buffer for OBS” 插件触发的保存。如果你用两个 RuneLite 客户端连同一个 OBS，请保持关闭，否则每个片段都会被发两次。',
          },
        ],
      },
      useHeading: 'C. 使用',
      useIntro: '发生了有趣的事 → 按下你的快捷键 → 聊天框会一路提示你：',
      useChat: [
        { text: 'Saving clip...', tone: 'plain' },
        { text: 'Uploading clip to the clan Discord...', tone: 'plain' },
        { text: 'Clip posted to the clan Discord.', tone: 'green' },
      ],
      reminder: {
        tag: '提醒',
        body: '片段覆盖的是你按键_之前_的那几秒 —— 所以要在事情发生之后按，而不是发生当时。你有整段缓冲的时长可以反应。',
      },
      decodedHeading: '片段相关提示，逐条解释',
      decoded: [
        {
          term: '`Clip capture: OBS isn’t connected.`',
          body: 'OBS 没在运行、WebSocket 服务器没开，或者主机/端口/密码对不上。修好后再按一次 —— 插件每 30 秒会自己重试一次连接。',
        },
        {
          term: '`OBS could not save the clip — is the Replay Buffer started?`',
          body: '缓冲没在跑。到 OBS 的输出设置里确认 Enable Replay Buffer，然后把 Enable clip capture 关掉再打开。',
        },
        {
          term: '`Clip saved locally — paste a Clips Discord webhook URL…`',
          body: '一切正常，只是你还没设置 webhook。文件就在你的 OBS 录制文件夹里。',
        },
        {
          term: '`Clip saved locally (48MB) — too big to auto-post.`',
          body: '缩短片段时长、降低 OBS 录制质量，或者在你的服务器接受更大文件的前提下调高上限。',
        },
        {
          term: '`…but Discord didn’t accept the upload.`',
          body: '太大、被限流，或者上传超时了。文件还在你电脑上 —— 值得的话手动发出去。',
        },
      ],
    },

    trouble: {
      title: '出问题的时候',
      intro:
        '记录中断时插件会在聊天里告诉你 —— 它会先等大约 90 秒才抱怨，并且最多每 5 分钟重复一次。',
      rows: [
        {
          term: '`Anvil: your Account Token was rejected — tracking is OFF.`',
          body: '令牌不对或已被轮换。从 [Profile → RuneLite plugin](/profile#plugin-token) 重新复制，或者清空该字段再从插件里重新登录。',
        },
        {
          term: '`Anvil: can’t reach the site — tracking is OFF.`',
          body: '检查 Site URL 有没有打错 —— 它应当是 `{origin}`。如果没错，那多半是站点挂了。',
        },
        {
          term: '`…you’re logged in as "<RSN>" but isn’t linked… your drops won’t count.`',
          body: '那个账号还没关联。到 Profile → “Accounts we noticed you playing” 里把它加上。',
        },
        {
          term: '`Anvil: reconnected — tracking is back on.`',
          body: '什么都不用做。它自己恢复了。',
        },
      ],
      logHeading: '还是不行？给管理员发一份日志',
      logBody:
        '在游戏聊天框里输入 `::anvillog`（或在插件的 Support 区块里设置 **Export debug log hotkey**）。它会往你的 `.runelite/anvil-debug` 文件夹写一份日志文件、打开该文件夹，并把路径复制到剪贴板 —— 把那个文件发给管理员，他们就能看到究竟哪里出了问题。',
      missingNote: {
        tag: '凭证不见了？',
        body: '宠物和重复的 Champion’s scroll 需要手动截图。插件会替你截好并保存到 `.runelite/osrs-bingo-pending/`（Anvil 侧边栏的 **Copy folder path** 可以打开该文件夹），你在网站上直接附加即可，不必事后再去翻找图片。',
      },
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
      { strong: '4 个步骤', rest: '在设置向导里' },
      { strong: '7 种赛制', rest: '可用来搭棋盘' },
      { strong: '1 个按钮', rest: '就能同步成员名单' },
    ],
    footnote:
      '本指南以今天发布的版本为准。如果这里的某个界面和你眼前看到的对不上，那是应用没错、指南过时了 —— [告诉我们](/feedback)，我们会修。',

    access: {
      title: '谁能做什么',
      intro:
        '所有人都用 Discord 登录 —— 没有密码。第一位管理员来自服务器配置；之后由管理员在 **Clan → Members & staff** 中提升他人。角色是向下叠加的：管理员（moderator）能做的一切，司库和 admin 也都能做。',
      rows: [
        {
          term: 'Admin',
          body: '完全权限 —— 活动、格子、队伍、设置、人员、奖金。请把它交给氏族能容忍的最少人数。',
        },
        { term: 'Treasurer', body: 'moderator 能做的一切，外加报名费与奖金发放。' },
        {
          term: 'Moderator',
          body: '日常事务：成员名单、验证、每周竞赛、日程、反馈。不能创建或编辑活动。',
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
        '**System → Setup** 是一个四步向导，仪表盘也会把同样这四项当成清单保留到它们完成为止：给氏族起名、接上 Discord、创建活动、添加格子。状态是按真实数据算出来的，因此某一步只有真正完成时才会被勾掉。',
      discord:
        'Discord 有两条路，而且可以叠加：给 Anvil 一个**机器人**，它就能创建 webhook、同步身份组和昵称、并为你搭建私密的队伍频道；只给它一个 **webhook 网址**，它就只能发公告、别的什么都做不了。想两分钟内跑起来就先用 webhook，等你需要自动化时再把机器人加上。',
      permsNote: {
        tag: '机器人权限',
        body: '机器人需要 _Manage Webhooks_、_Manage Roles_、_Manage Channels_ 和 _Manage Nicknames_，而且它的身份组在你服务器的身份组列表里必须排在它所管理的那些身份组_之上_。否则 Discord 会悄无声息地拒绝。',
      },
      hosted:
        '在托管方案下你已经见过那个界面一次了：设置过程中添加机器人，正是 Anvil 得知哪个服务器是你们的方式，所以从来就不存在什么服务器 ID 需要复制。想把机器人搬到另一个服务器时，同一个链接就在这里。',
    },

    channels: {
      title: '把播报分散到多个频道',
      body: [
        '默认情况下所有内容都发到一个主公告频道。等它变吵了，打开 **System → Advanced settings → Webhooks**，给那些吵闹的类别各自安个家 —— 宾果活动、每周竞赛、稀有掉落、死亡、PvP 击杀、combat achievements、片段。任何留空的类别都会回落到主频道，所以你可以一次只分出一个类别。',
        '接上机器人之后你完全不用碰 webhook 网址：从下拉框里选一个频道，按 **Create webhook**。活动繁忙时你可以给同一个频道再加一个 webhook —— Anvil 会在两者之间轮换，免得 Discord 的限流吞掉播报。',
      ],
      clipsNote: {
        tag: '片段频道不一样',
        body: '片段视频是从每位玩家自己的电脑直接上传到 Discord 的 —— 它们从不经过本站。因此你在这里设置的片段 webhook，是你要_发出去_的那一个：成员们自己把它粘进插件。本页其他所有内容都在服务端进行，成员永远看不到。',
      },
    },

    roster: {
      title: '把成员名单导进来',
      body: [
        '氏族成员资格只有一个来源：从游戏内同步一次成员名单。在一位_管理员_的账号上安装 [Anvil 的 RuneLite 插件]({pluginGuide})，打开游戏内 Collection Log 的 **Bingo** 标签页，然后按 **Sync clan roster**。这会一键把你们真实的游戏内氏族名单推送到网站。',
        '任何在网站上关联或验证了账号、却不在那份名单上的人都是**访客** —— 会被记录、可见，但在管理员提升他们或下一次同步把他们收进来之前都不算成员。这是有意为之：这意味着没有人能靠打一个名字把自己提升进你们的氏族。',
        '你也可以在 **Clan → Members & staff** 里手动添加某人，包括在他们无法访问网站时代为报名某场活动。',
      ],
    },

    board: {
      title: '创建你的第一块棋盘',
      intro:
        '**Events → All events → New event**。先选赛制 —— 它决定棋盘如何计分，以及表单接下来会问你什么。',
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
          blurb: '一条有序赛道 —— 队伍按顺序抵达各格；走得最远的获胜。',
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
        '活动的 **Tiles** 标签页，就是一块棋盘变成宾果的地方。每个格子是一_种_任务，而这个种类决定了插件盯着什么：一次掉落、一个 boss 击杀数、技能经验、一次 NPC 击杀、限时通关、成就日记、Combat Achievement、收藏日志解锁、PvP 击杀、物品获取，或一次零死亡的通关。手动格子 —— 由人依据截图核验的那种 —— 也始终是可选项。',
        '要填满整块棋盘，请批量编写：导出表格，在表格软件里填好，再导回来。CSV 与 .xlsx 都能双向往返，而且行与位置一一对应，所以你可以一次粘贴就把整块 25 格的网格重写一遍。',
      ],
      rows: [
        {
          term: '难度档位',
          body: '分值会映射到有名字的档位（easy → elite）。如果你的氏族有不同的分级习惯，可以在 Advanced settings 里编辑这些档位。',
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
        '**Teams & Draft** 标签页会随你选的赛制变化：不使用队伍的赛制会直接跳过它。对于普通的团队宾果，你创建队伍、决定谁当队长，然后要么自己分配玩家，要么开一场实时选秀。',
        '队长们按你指定的顺序从报名池里挑人，并且每位队长都能看到大家在报名表里填的答案 —— 这些答案在提交那一刻就被冻结，所以没人能在被选中之后改自己的「每周时长」。',
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
          body: 'System → Announce 能在活动进行中往你们的频道发一条消息，不用你自己手写 webhook。',
        },
      ],
      missionNote: {
        tag: '活动中途的惊喜',
        body: '你可以往进行中的宾果里丢一个**任务** —— 一个隐藏的加分格子，在你触发时才公布，还可以让它随时间贬值或过期。这是第五天把棋盘唤醒的最省事的办法。',
      },
      startProofNote: {
        tag: '阻止赛前囤积',
        body: [
          '打开 **Starting shot**（活动 → Overview），每位玩家就必须提交一张在开赛之后拍摄的截图，地点由 Anvil 在开赛那一刻抽取 —— 这样就没人能在零点坐拥一周攒下的线索卷和宝箱。地点随开赛一同公布；每位玩家的口令都是个人专属、由抽取结果推导而来，并且在活动开始前根本不存在，因此任何人都无法提前布置。',
          '把这些地点钉在世界地图上（地点池编辑器自带一个），插件就会检查玩家是否真的站在那里，而不是仅仅被口头告知。你还可以要求**新开的会话** —— 默认 15 分钟：hiscores 只在玩家退出登录时保存，所以让所有人在拍照前重登一次，才能让每个经验与击杀数格子背后的起始数值是诚实的。',
          '用插件的人按一个按钮就好。其余的人在游戏里打出自己的口令，然后在 My Team 上传。至于没交的人所产生的记账怎么处理，由你决定：标记待审（默认），或者在他们交上来之前一律拒绝。同一个 Overview 面板就是待审列表 —— 带有已验证口令的插件截图会以「已接受」的状态到达，所以实际上你只需要过一眼手机玩家。',
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
          body: '活动的 Payouts 标签页会把奖池变成一份「谁拿多少」的名单，并在你发放的过程中逐条勾掉。',
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
          body: '把你刚搭好的这块棋盘留下来。下一场宾果就从它开始，而不是从空网格开始。',
        },
      ],
      federation:
        '开启联合之后，成员还可以从插件里连接到其他 Anvil 氏族 —— 对跨氏族活动很方便，而且完全由每位成员自行选择。',
      outro: '之后把成员们指向[玩家设置指南]({pluginGuide})，然后开始筹备下一场。',
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
        '打开你的活动，进入 **Teams & Draft** 标签页。为每个受邀氏族各建一支队伍，并以他们的名字命名 —— 这个名字就是他们的玩家在报名表上看到的，所以「Ironforge」胜过「队伍 2」。',
        '你_不需要_跑选秀。邀请链接和选秀是两种替代方案：选秀是把一个共享的报名池分配出去，链接则是把人直接安排到位。在纯粹的氏族对抗赛里，大多数主办方会把队伍建好、每队发一条链接，然后压根不开选秀。',
        '接着打开队伍本身 —— **Teams & Draft → 该队伍** —— 因为接下来两步都在那里进行。',
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
        caption: '活动 → Teams & Draft → 该队伍 → Team staff',
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
        caption: '活动 → Teams & Draft → 该队伍 → Invite links',
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
        kill: { label: '击杀数', blurb: '击杀某种 NPC N 次 —— 连 hiscores 从不统计的也算（鸡、牛）。由插件识别。' },
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
          term: 'Boss 击杀数目标',
          body: '**不是** kill 类型的格子。kill 格子通过插件监视 NPC 死亡；击杀数目标是个 hiscores 数字，需要 `trackedStat` + `statType=boss` + `statGoal`。kill 格子留给 Hiscores 从来不统计的东西 —— 牛、鸡、某个特定的 slayer 怪。',
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
        '在活动的 **Tiles** 标签页点 **Download spreadsheet**。你会拿到一份反映棋盘当前状态的 .xlsx，下拉选项、物品清单和字段说明各占一个工作表。',
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
        '在按分数计的棋盘上，每个格子都带有自己的分值，而这些分值会映射到有名字的难度档位 —— easy 到 elite —— 如果你的氏族分级方式不同，可以在 **Advanced settings** 里修改这些档位。玩家读的是档位；计分的是数字。',
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
      '赛制在创建时确定，但之后可以在活动的 Overview 标签页里更改；公布策略和分数修正项，只要它们影响的格子尚未公布，随时都能改。',

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
      '报名费与奖金发放是司库的地盘。司库能做管理员能做的一切，外加这些；管理员可以把一笔费用标记为已收，但永远无法结清它。',

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
        '一笔费用需要几个签名，是一项氏族设置，范围是零到五。零之所以存在，是有真实理由的：在司库_就是_所有者的氏族里，根本没有第二个人可以签，于是「34 笔费用等待第二个签名」会变成一条永远清不空的队列，并且永远是仪表盘上最刺眼的东西。设为零时，把费用标记为已付**本身就是**那个签名。',
        '你们有两个人就设为一 —— 也就是默认值。如果坦白讲并没有第二个人，就设为零；只有在你们既有人手也有理由时，才把它调得更高。',
      ],
    },

    pay: {
      title: '发放',
      body: [
        '活动结束时，活动的 **Payouts** 标签页会把奖池变成一份人的名单。生成它，你得到的是每位受款人一行，而不是每支队伍一行：获胜队伍的奖金会在成员之间平分，好让「发钱」变成一份姓名与数字的清单，而不是半夜里的一道算术题。',
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
        '成员名单：同步它、添加成员、把访客提升为成员',
        '账号验证 —— 经验挑战和人工审核',
        '提交与凭证截图',
        '每周竞赛与日程',
        '来自成员的反馈',
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
          body: '最常见的情况，而且完全不需要你动手。带着已连接的插件玩那个账号，它就会自动关联，而稳定的账号指纹让这份关联在改名之后依然有效。',
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
        body: '验证一个账号，说的是「这确实是他的」。这并不会把他放进氏族 —— 氏族成员资格只来自游戏内的成员名单同步，或者由管理员手动添加。已验证但不在名单上的人是**访客**：被记录、可见，但不是成员。这是刻意的，也正是它挡住了任何人靠打一个名字就加入你们氏族。',
      },
    },

    roster: {
      title: '让成员名单保持诚实',
      body: [
        '成员名单只有一个来源：由管理员从游戏内的氏族列表跑一次同步，入口是氏族窗口标题栏上的 **Anvil** 按钮（或插件侧边栏的 **Sync roster**）。其他一切 —— 验证、关联、报名 —— 都挂在它上面。',
        '所以维护工作量很小但是实打实的：每轮招新之后跑一次同步、把真正加入了的访客提升为成员，并主动去看站点标记出来需要复核的人，而不是等他们来抱怨。',
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
};

export default zhHans;
