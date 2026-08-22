import type { PartialDiscordDict } from './en';

// 日本語 — Japanese.
//
// コマンド名そのものは英語のまま：日本語で読む人も入力するのは `/bingo board` であり、
// 訳したコマンド名は誰にも見つけられないコマンドになる。"Powered by Anvil" も同じ。
// それ以外のすべて —— 説明、順序、理由 —— は日本語。

const ja: PartialDiscordDict = {
  common: {
    noTeams: '_チームはまだありません。_',
    moreOnSite: 'サイトにあと {n} 件',
    more: 'あと {n} 件',
    bonusLegend: '⚡ ミッションボーナス —— ボード合計の上に加算されるため、スコアには入るが達成率には入らない。',
    visitingClansOne: '🤝 {names} は来訪クラン —— このボードは共有されています。',
    visitingClansMany: '🤝 {names} は来訪クラン —— このボードは共有されています。',
    visitingPlayersOne: '🤝 他クランから 1 名が参加しています。',
    visitingPlayersMany: '🤝 他クランから {n} 名が参加しています。',
    phaseRunning: '進行中',
    phaseUpcoming: '未開始',
    phaseEnded: '終了',
    phaseDraft: '下書き',
    contextVisitingTeamsOne: 'クラン横断 · 来訪チーム 1',
    contextVisitingTeamsMany: 'クラン横断 · 来訪チーム {n}',
    contextVisitingPlayersOne: '来訪プレイヤー 1 名',
    contextVisitingPlayersMany: '来訪プレイヤー {n} 名',
    shareButton: 'チャンネルに共有',
    sharedBy: '-# {who} が共有',
    fieldFormat: '形式',
    fieldTeams: 'チーム',
    fieldPlayers: 'プレイヤー',
    fieldTilesDone: '達成タイル',
    fieldTeamScore: 'チームスコア',
    fieldYourTiles: 'あなたのタイル',
    fieldAccounts: 'アカウント',
    fieldRank: '順位',
    fieldRoster: '名簿',
    fieldScore: 'スコア',
  },

  board: {
    starts: '{when}に開始。',
    ends: '{when}に終了。',
    finished: 'このボードは終了しました。',
    notScheduled: 'まだ日程未定です。',
    hidden: 'タイルはまだ非公開 —— 運営が公開するとボードが開きます。',
  },

  leaderboard: { title: '🏆 {event} —— 順位表' },

  rules: {
    title: '📜 {event} —— 仕組み',
    houseTitle: '📌 {clan} —— クラン独自ルール',
    houseContinues: '**ルールには続きがあります** —— 全文はこちら',
    houseFull: 'ルール全文：',
    houseTrimmed: '-# Discord に収めるため省略 —— 全文は運営に聞いてください。',

    scoringPoints: '• **採点** —— 各タイルは固有の点数を持ち、チームのスコアは達成したタイルの合計です。',
    scoringTiles: '• **採点** —— 1 タイル 1 点。チームのスコアは達成したタイル数です。',
    tileRace: '• **タイルレース** —— ボードは順番の決まったコースです。そこを進み、最も遠いタイルが順位になります。',
    revealScheduled: '• **公開** —— タイルは運営が組んだ予定どおりに開きます。まだ見えないタイルは、単にまだ開いていないだけです。',
    revealIntervalOne: '• **公開** —— {minutes} 分ごとに{order} 1 枚が抽選されます。',
    revealIntervalMany: '• **公開** —— {minutes} 分ごとに{order} {n} 枚が抽選されます。',
    revealOrderRandom: 'ランダムで',
    revealOrderBoard: 'ボード順に',
    revealBounty: '• **バウンティ** —— 同時に開いているのは 1 枚だけ。最初に達成したチームがそれを閉じ、次が抽選されます。',
    revealRotating: '• **ローテーション** —— 同時に {n} 枚が開いたまま。新しく引かれるたび古いものが期限切れになります。開いているうちに達成を。',
    revealAll: '• **公開** —— ボード全体が最初から開いています。',
    notRevealed: '• **まだ非公開** —— イベント開始時に運営がボードを開きます。それまで誰もタイルを見られません。',
    lockout: '• **ロックアウト** —— 最初に達成したチームが取ります。以後、他は得点できません。',
    firstBonus: '• **一番乗りボーナス** —— そのタイルの最初のチームに {amount} 点が追加されます。',
    decay: '• **減衰** —— タイルは公開時が満点で、{hours} 時間かけて {pct}% まで下がります。早い達成ほど高得点。',
    growth: '• **増価** —— タイルは満額から始まり、{hours} 時間かけて {pct}% まで上がります。待つほど高得点。',
    missions: '• **ミッション** —— イベント途中で公開される追加目標、{when}。発表前は誰にも見えません。',
    missionWhenInterval: '{minutes} 分ごと',
    missionWhenScheduled: '予定に従って',
    missionWhenManual: '運営が投下したとき',
    missionBonusNote:
      '-# ミッションの点は**ボーナス** —— あなたのスコアには加わりますが、ボード合計には決して加わりません。途中でボードが長くなることはありません。',
    missionAnnouncedCount: 'これまでに {total} 件中 {announced} 件が発表済み。',
    startProofStrict:
      '• **スタートショット** —— 全員が開始後に 1 枚のスクリーンショットを提出します。場所は開始の瞬間に抽選されます。提出するまで、あなたの申請はすべて却下されます。',
    startProofFlag:
      '• **スタートショット** —— 全員が開始後に 1 枚のスクリーンショットを提出します。場所は開始の瞬間に抽選されます。提出するまで、あなたの申請はすべて確認待ちになります。',
    startProofSession:
      '-# 先にログアウトして入り直してください —— ハイスコアはログアウト時にしか保存されないため、撮影は新しいログインから {minutes} 分以内である必要があります。',
    teamChoice: '• **チーム** —— 参加登録時に自分でチームを選び、運営が承認します。',
    captainInvites: '• **チーム** —— キャプテンが自分の側の招待リンクを自ら配ります。',
    entryFee: '• **参加費** —— 1 登録につき {amount}。',
    prizePool: '• **賞金プール** —— {amount}。承認された登録ごとに増えていきます。',

    trackingHeading: '**達成が記録される仕組み**',
    trackingPlugin: '• **Anvil プラグインがあれば** —— 代わりに送信してくれます。あとは遊ぶだけ。',
    trackingHiscoresAll:
      '• **プラグインなし？** ここのタイルはすべて**公式ハイスコア**を読むので、クライアントは一切不要 —— ただしハイスコアは**ログアウト**時にしか保存されず、毎正時に更新されます。遊ぶ → ログアウト → 正時を待つ。',
    trackingHiscoresSome:
      '• **プラグインなし？** このうち {n} 枚は**公式ハイスコア**を読むので、クライアントは一切不要 —— ただしハイスコアは**ログアウト**時にしか保存されず、毎正時に更新されます。遊ぶ → ログアウト → 正時を待つ。',
    trackingProofAll:
      '• **ドロップ・討伐・タイムアタック**には証拠が必要 —— ここでは全タイルが該当します。プラグインが自動で保存します。ない場合は{where}自分でスクリーンショットをアップロードしてください。',
    trackingProofSome:
      '• **ドロップ・討伐・タイムアタック**には証拠が必要 —— このうち {n} 枚です。プラグインが自動で保存します。ない場合は{where}自分でスクリーンショットをアップロードしてください。',
    trackingWhereUrl: '{url}/team の **My Team** で',
    trackingWhereNoUrl: 'My Team ページで',
    trackingKeepShot: '-# いずれにせよ大きな出来事は自分でもスクリーンショットを残してください —— 手間はゼロで、あらゆる揉め事を終わらせます。',
  },

  me: {
    title: '👤 {who} —— {event}',
    notEnteredTitle: '🔍 このボードには参加していません',
    notEntered: '**{event}** には登録されていません。',
    notEnteredWhere: '参加登録とプロフィールは {url} にあります。',
    onTeam: 'あなたは **{team}** です。',
    onTeamRanked: 'あなたは **{team}** —— {total} 中 {place}。',
    noTeamYet: '登録済みですが、まだチームに入っていません。',
    finishedHiddenOne: '1 枚達成済み —— 名前はボード公開後に表示されます。',
    finishedHiddenMany: '{n} 枚達成済み —— 名前はボード公開後に表示されます。',
    finishedHeading: '**あなたが達成したタイル**',
    nothingYet: 'まだあなたに記録されたタイルはありません。',
  },

  team: {
    noTeamsTitle: '🔍 チームはまだありません',
    noTeamsBody: '**{event}** にはまだチームがありません。',
    noMatchTitle: '🔍 そのチームはありません',
    noMatch: '**{event}** に「{needle}」に一致するチームはありません。',
    noneOfYours: 'あなたはチームに入っていません —— 名前を指定して調べてください。',
    teamsList: '**チーム：** {names}',
    standing: '{total} 中 {place} —— {score}{bonus} · ボードの {pct}%。',
    bonusSuffix: '（⚡+{n} ミッションボーナス）',
    visitingWholeTeam: '🤝 来訪クラン：{names}',
    visitingSomeOne: '🤝 来訪プレイヤー 1 名：{names}',
    visitingSomeMany: '🤝 来訪プレイヤー {n} 名：{names}',
    recentHeading: '**最近のタイル**',
    hiddenBoard: '**{event}** のタイルはまだ非公開 —— チームカードはボードと同時に開きます。',
  },

  apply: {
    title: '📝 {event} —— 参加方法',
    drafted: '**参加済みです** —— すでにドラフトでチームに入っています。あとは遊ぶだけ。',
    approved: '**登録・承認済みです。** イベント開始前にチームへ配置されます。',
    pending: '**登録は受理済み**で、運営の承認待ちです。ほかにすることはありません。',
    open: '**参加登録は受付中です。**',
    notOpenYet: '**参加登録はまだ始まっていません。**',
    eventStarted: '**イベントは既に開始**したため、登録は締め切られています。まだ空きがあるか運営に聞いてください。',
    closed: '**参加登録は締め切られました。**',
    closesIn: '{when}に締め切ります。',
    opensIn: '{when}に開きます。',
    fee: '参加費は {amount} —— 送り先は運営が教えてくれます。',
    feePerAccount: '参加費はアカウントごとに {amount} —— 送り先は運営が教えてくれます。',
    signUpAt: '**参加登録：** {url}',
    noAccountUrl:
      '-# Anvil はまだあなたのアカウントを知りません。先に {url}/profile で RSN を紐づけてください —— 登録は Discord 名ではなくアカウントに紐づきます。',
    noAccountNoUrl:
      '-# Anvil はまだあなたのアカウントを知りません。先にプロフィールページで RSN を紐づけてください —— 登録は Discord 名ではなくアカウントに紐づきます。',
  },

  next: {
    title: '⏭️ {event} —— 次にくるもの',
    eventStarts: '🚩 イベント開始',
    eventEnds: '🏁 イベント終了',
    nextTile: '🎲 次のタイル抽選',
    nextMission: '⚡ 次のミッション',
    signupsClose: '📝 参加登録の締め切り',
    nothingEnded: '時計に残っているものはありません —— このボードは終了しました。',
    nothingScheduled: '予定はありません。運営が次を投下したときが、そのときです。',
    hiddenMissionsOne: '-# ミッションがあと 1 件。運営が投下したときに発表されます。',
    hiddenMissionsMany: '-# ミッションがあと {n} 件。運営が投下したときに発表されます。',
  },

  help: {
    title: '🔨 Anvil が答えられること',
    privateNote: '-# 回答はあなただけに見えます。回答の下の **{share}** ボタンでチャンネルに投稿できます。',
    subs: {
      board: '今まさに進行中のボード',
      leaderboard: 'チーム順位',
      rules: 'このボードの仕組み —— 採点、公開、証拠、そしてクラン独自ルール',
      apply: '参加方法 —— 登録、参加費、そしてあなたの状況',
      next: 'これから起きること —— 次の公開、ミッション、締め切り',
      me: 'あなたのチーム、タイル、順位',
      help: 'ここで Anvil が答えられること',
      team: 'チームのカード —— スコア、名簿、最近のタイル',
    },
    command: 'Anvil —— クランのボードを見る',
    optionTeamName: 'チーム名（空欄なら自分のチーム）',
  },

  rolePanel: {
    modalTitle:
      'あと一つだけ',
    modalLabel:
      'あなたの RuneScape 名',
    modalPlaceholder:
      'ゲーム内と完全に同じ表記で',
    granted:
      '✅ **{label}** として設定しました。',
    optionGone:
      'このボタンは古くなっています —— 運営にパネルの貼り直しを頼んでください。',
    grantFailed:
      '⚠️ ロールが付きませんでした。Anvil のボットロールは、配るロールより**上**にある必要があります —— 管理者に確認を頼んでください。',
    rsnSaved:
      '📋 **{rsn}** をあなたの RuneScape 名として保存しました。',
    rsnSavedRenamed:
      '📋 **{rsn}** をあなたの RuneScape 名として保存し、ニックネームも合わせました。',
    rsnPending:
      '-# イベントに反映されるには、そのアカウントがあなたのものだとモデレーターが確認する必要があります。',
    rsnInvalid:
      'RuneScape 名には見えません —— 1〜12 文字、ゲーム内と完全に同じ表記で。',
    rsnTaken:
      '**{rsn}** はすでに別の人に紐づいています。誤りであればモデレーターに相談してください。',
    failed:
      'Anvil は最後まで実行できませんでした。管理者がサイトのログを確認できます。',
  },

  errors: {
    dm: 'クランの Discord サーバーで実行してください —— ボードコマンドはどのクランからの質問かを知る必要があります。',
    wrongGuild:
      'このボットは **{clan}** の Anvil とは別のサーバーに接続されています。管理者に Integrations のサーバー ID を確認してもらってください。',
    unknownCommand: 'Anvil は {command} に応答しません —— {suggestion} を試してください。',
    unknownSub: '不明なコマンドです。{list} を試してください。',
    noBoards: '**{clan}** にはまだボードがありません。',
    noBoardsStaff: '運営は {url}/admin/events/new で作成できます。',
    failed: 'Anvil が応答中にエラーになりました。管理者がサイトのログを確認できます。',
    unsupported: 'その種類のインタラクションはまだ対応していません。',
    shareExpired: 'その回答は古すぎて共有できません —— コマンドを実行し直してください。',
  },
};

export default ja;
