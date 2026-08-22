import type { PartialDiscordDict } from './en';

// 简体中文 — Simplified Chinese.
//
// 命令名本身保持英文：读中文的人照样输入 `/bingo board`，翻译过的命令名是没人找得到的命令。
// “Powered by Anvil” 同理。其余的一切 —— 解释、顺序、原因 —— 都是中文。

const zhHans: PartialDiscordDict = {
  common: {
    noTeams: '_还没有队伍。_',
    moreOnSite: '网站上还有 {n} 条',
    more: '还有 {n} 条',
    bonusLegend: '⚡ 任务加分 —— 在版面总分之外另外获得，因此计入得分，但不计入百分比。',
    visitingClansOne: '🤝 {names} 是来访家族 —— 这块版面是共享的。',
    visitingClansMany: '🤝 {names} 是来访家族 —— 这块版面是共享的。',
    visitingPlayersOne: '🤝 有 1 名玩家来自其他家族。',
    visitingPlayersMany: '🤝 有 {n} 名玩家来自其他家族。',
    phaseRunning: '进行中',
    phaseUpcoming: '尚未开始',
    phaseEnded: '已结束',
    phaseDraft: '草稿',
    contextVisitingTeamsOne: '跨家族 · 1 支来访队伍',
    contextVisitingTeamsMany: '跨家族 · {n} 支来访队伍',
    contextVisitingPlayersOne: '1 名来访玩家',
    contextVisitingPlayersMany: '{n} 名来访玩家',
    shareButton: '分享到频道',
    sharedBy: '-# 由 {who} 分享',
    fieldFormat: '赛制',
    fieldTeams: '队伍',
    fieldPlayers: '玩家',
    fieldTilesDone: '已完成格子',
    fieldTeamScore: '队伍得分',
    fieldYourTiles: '你的格子',
    fieldAccounts: '账号',
    fieldRank: '名次',
    fieldRoster: '阵容',
    fieldScore: '得分',
  },

  board: {
    starts: '{when}开始。',
    ends: '{when}结束。',
    finished: '这块版面已经结束了。',
    notScheduled: '尚未排期。',
    hidden: '格子仍然隐藏中 —— 管理组公开后版面才会打开。',
  },

  leaderboard: { title: '🏆 {event} —— 排名' },

  rules: {
    title: '📜 {event} —— 玩法说明',
    houseTitle: '📌 {clan} —— 家族规矩',
    houseContinues: '**规则还有后续** —— 完整内容见',
    houseFull: '完整规则：',
    houseTrimmed: '-# 为适配 Discord 已截断 —— 向管理组索取完整规则。',

    scoringPoints: '• **计分** —— 每个格子有自己的分值；队伍得分是已完成格子的分值总和。',
    scoringTiles: '• **计分** —— 每格 1 分；队伍得分就是完成了多少格。',
    tileRace: '• **格子竞速** —— 版面是一条有顺序的赛道。你们沿着它前进；走到最远的格子就是你们的位置。',
    revealScheduled: '• **公开** —— 格子按管理组设定的时间表打开。你还看不到的格子，就是还没开。',
    revealIntervalOne: '• **公开** —— 每 {minutes} 分钟{order}抽出 1 个格子。',
    revealIntervalMany: '• **公开** —— 每 {minutes} 分钟{order}抽出 {n} 个格子。',
    revealOrderRandom: '随机',
    revealOrderBoard: '按版面顺序',
    revealBounty: '• **悬赏** —— 同一时间只开放一个格子。第一支完成的队伍将其关闭，随即抽出下一个。',
    revealRotating: '• **轮换** —— 同时保持 {n} 个格子开放；每次抽新格，最旧的就过期。趁开着的时候完成它们。',
    revealAll: '• **公开** —— 整块版面从一开始就全部开放。',
    notRevealed: '• **尚未公开** —— 活动开始时由管理组打开版面。在那之前没人看得到格子。',
    lockout: '• **独占** —— 第一支完成格子的队伍拿走它。此后其他人都无法再计分。',
    firstBonus: '• **首完成加分** —— 第一支完成该格的队伍额外获得 {amount} 分。',
    decay: '• **衰减** —— 格子在开放时为满分，并在 {hours} 小时内滑落到 {pct}%。越早完成得分越高。',
    growth: '• **增值** —— 格子从满值起步，在 {hours} 小时内爬升到 {pct}%。越晚完成得分越高。',
    missions: '• **任务** —— 活动进行中才公开的额外目标，{when}。公布之前谁也看不到。',
    missionWhenInterval: '每 {minutes} 分钟一次',
    missionWhenScheduled: '按时间表',
    missionWhenManual: '由管理组随时投放',
    missionBonusNote:
      '-# 任务分是**加分** —— 只计入你的得分，绝不计入版面总分，所以版面不会在活动中途变长。',
    missionAnnouncedCount: '目前已公布 {announced}/{total} 个。',
    startProofStrict:
      '• **开局截图** —— 每位玩家须在开赛后提交一张截图，地点在开赛瞬间抽出。在你交出自己的之前，你提交的一切都会被拒绝。',
    startProofFlag:
      '• **开局截图** —— 每位玩家须在开赛后提交一张截图，地点在开赛瞬间抽出。在你交出自己的之前，你提交的一切都会被标记待审。',
    startProofSession:
      '-# 请先退出再重新登录 —— 排行榜只在登出时保存，所以你的截图必须在一次全新登录后的 {minutes} 分钟内完成。',
    teamChoice: '• **队伍** —— 报名时自己选队；由管理组批准。',
    captainInvites: '• **队伍** —— 队长自行分发本队的邀请链接。',
    entryFee: '• **报名费** —— 每次报名 {amount}。',
    prizePool: '• **奖池** —— {amount}，每通过一份报名就上涨。',

    trackingHeading: '**成绩如何被记下**',
    trackingPlugin: '• **装了 Anvil 插件** —— 它替你提交。除了玩什么都不用做。',
    trackingHiscoresAll:
      '• **没装插件？** 这里每一个格子都读取**官方排行榜**，因此完全不需要客户端 —— 但排行榜只在你**登出**时保存，并整点刷新。玩 → 登出 → 等整点。',
    trackingHiscoresSome:
      '• **没装插件？** 其中 {n} 个格子读取**官方排行榜**，因此完全不需要客户端 —— 但排行榜只在你**登出**时保存，并整点刷新。玩 → 登出 → 等整点。',
    trackingProofAll:
      '• **掉落、击杀和限时任务**需要凭证 —— 这里每一个格子都是。插件会自动归档；没有插件就自己{where}上传截图。',
    trackingProofSome:
      '• **掉落、击杀和限时任务**需要凭证 —— 其中 {n} 个。插件会自动归档；没有插件就自己{where}上传截图。',
    trackingWhereUrl: '到 {url}/team 的 **My Team** 页面',
    trackingWhereNoUrl: '在 My Team 页面',
    trackingKeepShot: '-# 不管怎样，重要的东西都自己留一张截图 —— 不花任何成本，却能了结任何争议。',
  },

  me: {
    title: '👤 {who} —— {event}',
    notEnteredTitle: '🔍 你不在这块版面上',
    notEntered: '你没有报名 **{event}**。',
    notEnteredWhere: '报名和个人资料都在 {url}。',
    onTeam: '你在 **{team}**。',
    onTeamRanked: '你在 **{team}** —— {total} 支队伍中的{place}。',
    noTeamYet: '你已报名，但还没有分到队伍。',
    finishedHiddenOne: '你已完成 1 个格子 —— 版面公开后才会显示名称。',
    finishedHiddenMany: '你已完成 {n} 个格子 —— 版面公开后才会显示名称。',
    finishedHeading: '**你完成的格子**',
    nothingYet: '目前还没有格子记在你名下。',
  },

  team: {
    title: '🛡️ {team}',
    noTeamsTitle: '🔍 还没有队伍',
    noTeamsBody: '**{event}** 上还没有任何队伍。',
    noMatchTitle: '🔍 没有这支队伍',
    noMatch: '**{event}** 上没有与“{needle}”匹配的队伍。',
    noneOfYours: '你不在任何队伍里 —— 说出一个队名来查看。',
    teamsList: '**队伍：** {names}',
    standing: '{total} 支队伍中的{place} —— {score}{bonus} · 版面的 {pct}%。',
    bonusSuffix: '（⚡+{n} 任务加分）',
    visitingWholeTeam: '🤝 一支来访家族：{names}',
    visitingSomeOne: '🤝 1 名来访玩家：{names}',
    visitingSomeMany: '🤝 {n} 名来访玩家：{names}',
    recentHeading: '**最近完成的格子**',
    hiddenBoard: '**{event}** 的格子尚未公开 —— 队伍卡片会随版面一起打开。',
  },

  apply: {
    title: '📝 {event} —— 如何加入',
    drafted: '**你已经在里面了** —— 已在选秀中被选入队伍。剩下的只有开玩。',
    approved: '**你已报名并通过审核。** 活动开始前会把你分进队伍。',
    pending: '**你的报名已提交**，正等管理组审核。不用再做什么了。',
    open: '**报名开放中。**',
    notOpenYet: '**报名尚未开放。**',
    eventStarted: '**活动已经开始**，所以报名已关闭。问问管理组还有没有名额。',
    closed: '**报名已关闭。**',
    closesIn: '{when}截止。',
    opensIn: '{when}开放。',
    fee: '参加费用为 {amount} —— 管理组会告诉你交到哪里。',
    feePerAccount: '每个账号 {amount} —— 管理组会告诉你交到哪里。',
    signUpAt: '**报名：** {url}',
    noAccountUrl:
      '-# Anvil 还不认识你的账号。请先在 {url}/profile 绑定你的 RSN —— 报名挂在账号上，而不是 Discord 名字上。',
    noAccountNoUrl:
      '-# Anvil 还不认识你的账号。请先在个人资料页绑定你的 RSN —— 报名挂在账号上，而不是 Discord 名字上。',
  },

  next: {
    title: '⏭️ {event} —— 接下来',
    eventStarts: '🚩 活动开始',
    eventEnds: '🏁 活动结束',
    nextTile: '🎲 抽出下一个格子',
    nextMission: '⚡ 下一个任务',
    signupsClose: '📝 报名截止',
    nothingEnded: '时钟上已经没有东西了 —— 这块版面已经结束。',
    nothingScheduled: '没有安排。管理组什么时候投放，就什么时候来。',
    hiddenMissionsOne: '-# 还有 1 个任务未出，等管理组投放时公布。',
    hiddenMissionsMany: '-# 还有 {n} 个任务未出，等管理组投放时公布。',
  },

  help: {
    title: '🔨 Anvil 能告诉你什么',
    privateNote: '-# 回答只有你自己看得见。点回答下方的 **{share}** 按钮即可发到频道里。',
    subs: {
      board: '当前正在进行的版面',
      leaderboard: '队伍排名',
      rules: '这块版面怎么玩 —— 计分、公开、凭证，以及家族规矩',
      apply: '如何加入 —— 报名、费用，以及你的状态',
      next: '接下来会发生什么 —— 下一次公开、任务或截止时间',
      me: '你的队伍、你的格子、你的名次',
      help: 'Anvil 在这里能告诉你什么',
      team: '一支队伍的卡片 —— 得分、阵容、最近完成的格子',
    },
    command: 'Anvil —— 查看家族版面',
    optionTeamName: '队名（留空则查看你自己的队伍）',
  },

  errors: {
    dm: '请在你家族的 Discord 服务器里运行 —— 版面命令需要知道是哪个家族在问。',
    wrongGuild: '这个机器人连接的服务器和 **{clan}** 的 Anvil 不是同一个。请管理员到 Integrations 里核对服务器 ID。',
    unknownCommand: 'Anvil 不回应 {command} —— 试试 {suggestion}。',
    unknownSub: '未知命令。试试 {list}。',
    noBoards: '**{clan}** 还没有任何版面。',
    noBoardsStaff: '管理组可以在 {url}/admin/events/new 创建一个。',
    failed: 'Anvil 在回答时出错了。管理员可以查看站点日志。',
    unsupported: '这种交互类型暂不支持。',
    shareExpired: '那条回答太旧了，无法分享 —— 请重新运行命令。',
  },
};

export default zhHans;
