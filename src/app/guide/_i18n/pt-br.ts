import type { PartialGuideDict } from './en';

// Português (Brasil) — Brazilian Portuguese.
//
// Mesma convenção dos outros arquivos de idioma: fica em inglês tudo o que o leitor realmente vê na
// tela —— os menus do RuneLite e do OBS, as linhas de chat que o próprio plugin imprime e os rótulos
// do painel administrativo do Anvil (em inglês enquanto aquelas telas não forem traduzidas).
// Traduzir “Tracked drop detected” faz com que quem procura aquela linha nunca mais a encontre.
// Todo o resto —— as explicações, a ordem, o porquê —— está em português.

const ptBr: PartialGuideDict = {
  common: {
    contents: 'Conteúdo',
    step: 'Passo',
    optional: 'opcional',
    minRead: 'leitura de {n} min',
    language: 'Idioma',
    partialNotice:
      'Este guia está traduzido para {language} apenas em parte. O que ainda não foi traduzido aparece em inglês.',
    backToGuides: 'Todos os guias',
    unreviewedNotice:
      'Esta tradução para {language} ainda não foi revisada por um falante nativo. Se alguma frase soar errada, a [página em inglês]({englishHref}) é o original —— e [nos avisar](/feedback) é o que faz a correção acontecer.',
  },

  index: {
    metaTitle: 'Guias — Anvil',
    metaDescription:
      'Guias de configuração do Anvil: o plugin do RuneLite para jogadores, como conduzir um evento para a staff do clã e como receber um clã visitante.',
    title: 'Guias',
    dek: 'Tudo o que você precisa para começar, escrito para a versão do Anvil que está rodando bem aqui.',
    groups: {
      playing: 'Jogando',
      running: 'Conduzindo um evento',
      clan: 'Tocando o clã',
    },
    cards: {
      plugin: {
        eyebrow: 'Para jogadores',
        title: 'Configuração do plugin do RuneLite',
        blurb:
          'Instale o plugin, conecte-o a este site e deixe que ele envie seus drops. Cobre notificações no Discord e clipes com OBS.',
        minutes: '~3 min de configuração',
      },
      admin: {
        eyebrow: 'Para a staff do clã',
        title: 'Conduzindo seu primeiro evento',
        blurb:
          'Discord, sincronização do quadro de membros, tabuleiros, casas, times e draft, largada, e o que fazer quando o evento termina.',
        minutes: 'uma noite, uma vez só',
      },
      board: {
        eyebrow: 'Para quem monta tabuleiros',
        title: 'Um tabuleiro que se registra sozinho',
        blurb:
          'O que cada tipo de casa realmente enxerga, escrita em massa por planilha, e os erros que importam sem falha e depois nunca disparam.',
        minutes: '~8 min',
      },
      captain: {
        eyebrow: 'Para capitães',
        title: 'Guia do capitão',
        blurb:
          'Ler o pool antes de o relógio começar, o dia do draft em si, e as partes de tocar um time que só começam depois dele.',
        minutes: '~6 min',
      },
      formats: {
        eyebrow: 'Para a staff do clã',
        title: 'Formatos, e como as casas abrem',
        blurb:
          'Sete formatos de tabuleiro, cinco maneiras de uma casa virar jogável, e os três modificadores que decidem quanto vale uma conclusão.',
        minutes: '~5 min',
      },
      fees: {
        eyebrow: 'Para tesoureiros',
        title: 'Taxas e premiação',
        blurb:
          'Cobrar uma taxa de inscrição, recebê-la, a segunda assinatura que a encerra, e transformar o bolo em pagamentos feitos.',
        minutes: '~5 min',
      },
      moderator: {
        eyebrow: 'Para moderadores',
        title: 'De plantão',
        blurb:
          'A fila, verificar envios e contas, manter o quadro de membros honesto, e as decisões que chegam a uma pessoa.',
        minutes: '~5 min',
      },
      clanVsClan: {
        eyebrow: 'Para quem recebe',
        title: 'Recebendo um clã visitante',
        blurb:
          'Clã contra clã sem coletar um único RSN na mão: um link de convite por time, e um assento que deixa o moderador deles tocar a própria metade.',
        minutes: '~5 min por time',
      },
    },
  },

  plugin: {
    metaTitle: 'Configuração do plugin do RuneLite — Anvil',
    metaDescription:
      'Instale o plugin Anvil para RuneLite, conecte-o a este site e configure notificações no Discord e clipes com OBS.',
    eyebrow: 'Anvil · plugin do RuneLite',
    title: 'Guia de configuração para jogadores',
    dek: 'Instale, aponte para {clanName} e jogue. O plugin envia seus drops do bingo, publica seus drops raros e mortes no Discord e —— se você usa OBS —— salva e publica clipes dos momentos que valem rever.',
    facts: [
      { strong: '2 campos', rest: 'para começar a rastrear' },
      { strong: '~3 min', rest: 'para a configuração básica' },
      { strong: 'Clipes', rest: 'precisam de OBS e mais 5 minutos' },
    ],
    footnote:
      'As capturas vêm de uma instalação real —— o token da conta, o endereço do OBS e o webhook do Discord estão borrados de propósito. Os seus devem continuar igualmente privados.',

    install: {
      title: 'Instale o plugin',
      body: [
        'No RuneLite: **Configuration** (a chave inglesa) → **Plugin Hub** → procure **Anvil** → **Install**. O autor é `AhmedFathy2001`.',
        'Um único plugin atende todos os clãs —— você o aponta para este site no passo seguinte, então não há nada específico do clã para baixar. Depois de instalado, abra **Configuration → Anvil** para chegar ao painel de configurações mostrado ao longo deste guia.',
      ],
    },

    connect: {
      title: 'Conecte a este site',
      intro: 'Para começar, só a seção **Setup** importa. Todo o resto tem padrões razoáveis.',
      figure: {
        caption: 'Configuration → Anvil → Setup',
        alt: 'A seção Setup do plugin Anvil, com os campos Site URL e Account Token destacados',
        legend: [
          {
            label: 'Site URL',
            body: 'para {clanName} é `{origin}`. Vem vazio, então você precisa preencher. Não precisa da barra no fim, e `https://` é adicionado se você omitir.',
          },
          {
            label: 'Account Token',
            body: 'sua chave pessoal para este site. Ou deixe o plugin preencher para você (abaixo), ou cole você mesmo. Trate como uma senha.',
          },
        ],
      },
      easyHeading: 'O jeito fácil: entre pelo plugin',
      easyIntro:
        'Com o Site URL preenchido e o token ainda vazio, o **painel lateral do Anvil** mostra um botão **Sign in with Discord**. Clique nele e o plugin conduz o resto —— sem copiar nada.',
      easySteps: [
        'O painel mostra um código e abre o navegador neste site.',
        'Confira se o código na página bate com o do RuneLite e clique em **Approve**.',
        'O painel diz _Signed in_ e preenche o Account Token para você.',
      ],
      linkFigure: {
        caption: 'Este site → /link-device',
        alt: 'A página “Link your RuneLite client”, com o campo do código e o botão Approve destacados',
        legend: [
          { label: 'O código', body: 'precisa bater com o que o plugin está mostrando neste exato momento.' },
          {
            label: 'Approve',
            body: 'só aprove um código que o _seu próprio_ cliente esteja exibindo. Se alguém te mandou um link ou um código, recuse —— aprovar entregaria sua conta.',
          },
        ],
      },
      brokeredNote: {
        tag: 'Por que aparece um segundo domínio',
        body: [
          'A aprovação acontece aqui, em `{origin}`. Se você ainda não entrou no site, o passo de login passa pelo login compartilhado do Anvil com Discord em `anvilosrs.com` para confirmar sua identidade no Discord e te traz direto de volta —— é o mesmo login que o botão Login deste site oferece, não faz parte do fluxo do plugin.',
          'O plugin em si só conversa com `{origin}`: ele se recusa a abrir qualquer página de login que não esteja no Site URL que você digitou.',
        ],
      },
      directNote: {
        tag: 'Onde isso acontece',
        body: [
          'Tudo neste fluxo fica em `{origin}` —— o código é emitido aqui, aprovado aqui com o login do Discord do {clanName}, e o token volta para cá. O plugin se recusa a abrir qualquer página de login que não esteja no Site URL que você digitou, então nada neste passo chega a outra instância do Anvil.',
        ],
      },
      federationAside:
        'Não confunda com **Connect clans** no painel lateral —— aquele é o botão separado e opcional que te liga a outros clãs Anvil, e só aparece depois que você já entrou aqui.',
      manualFallback:
        'Se o navegador não abrir sozinho, o painel imprime o endereço e o código para você abrir na mão. Os códigos expiram em dez minutos —— basta apertar o botão de novo.',
      manualHeading: 'O jeito manual: copie seu token',
      manualIntro:
        'Entre com o Discord e abra o [Perfil](/profile), depois role até o cartão **RuneLite plugin**.',
      tokenFigure: {
        caption: 'Perfil → RuneLite plugin',
        alt: 'O cartão RuneLite plugin na página de perfil, com o campo do token e os botões Reveal, Copy e Rotate destacados',
        legend: [
          {
            label: 'Seu token',
            body: 'escondido até você apertar Reveal. Está borrado nesta captura de propósito; nunca publique o seu no Discord.',
          },
          {
            label: 'Copy / Rotate',
            body: 'copie para o campo Account Token do plugin. Rotate emite um novo e mata o antigo —— use se achar que seu token vazou.',
          },
        ],
      },
      goodToKnow: {
        tag: 'Bom saber',
        body: ['Um token cobre todos os eventos em que você está inscrito aqui —— você nunca precisa colá-lo de novo a cada bingo.'],
      },
    },

    accounts: {
      title: 'Vincule suas contas —— é só jogar',
      body: [
        'Não há código nenhum para digitar. Com o token preenchido, qualquer conta em que você entrar é associada automaticamente ao seu perfil.',
        'O plugin envia seu nome no jogo mais uma impressão digital estável da conta em cada requisição, e o site casa primeiro pela impressão digital —— então seus vínculos sobrevivem a uma troca de nome. Entre uma vez numa alt e ela aparece no seu Perfil em _Accounts we noticed you playing_ com um botão **Add**.',
      ],
      figure: {
        caption: 'Perfil → RuneScape Accounts',
        alt: 'O cartão RuneScape Accounts na página de perfil listando contas verificadas via plugin',
        legend: [
          {
            label: 'Suas contas vinculadas',
            body: 'tudo marcado como “Verified via plugin” chegou lá só por ter sido jogado. Adicione quantas alts quiser; uma delas é a principal.',
          },
        ],
      },
      noPluginHeading: 'Não consegue usar o plugin?',
      noPluginIntro:
        'No celular ou no cliente oficial, vincule pelo site —— o Perfil mostra as duas opções:',
      noPluginOptions: [
        '**Verify by XP** —— informe seu RSN, o site sorteia uma skill, ganhe 1.000 XP nela em até 30 minutos.',
        '**Manual review** —— para Hiscores ocultos ou alts novas: envie seu RSN com uma observação e um moderador aprova.',
      ],
      signupNote: 'Inscrever-se num evento exige ao menos uma conta verificada, então resolva isso antes de se inscrever.',
    },

    working: {
      title: 'Confirme que está funcionando',
      intro: 'Entre no jogo e leia o chat. O plugin te cumprimenta quando está conectado e há um evento rolando.',
      chat: [
        { text: 'Bingo running: Summer Bingo 2026.', tone: 'gold' },
        { text: 'Skill of the Week is live: Runecraft.', tone: 'gold' },
        { text: '…mais tarde, conforme as coisas acontecem…', tone: 'muted' },
        { text: 'Tracked drop detected: Dragon warhammer (1/1)', tone: 'plain' },
        { text: 'Tracked kill: Zulrah (7/10)', tone: 'plain' },
      ],
      outro:
        'Você também deve ver o **painel lateral do Anvil** se preencher com seus clãs, seus eventos em andamento, sua colocação e os botões de sincronização — e um botão **Anvil** aparecer na barra de título do seu Collection Log no jogo, ao lado do WikiSync e do RuneProfile.',
      guestNote: {
        tag: 'Convidado x membro',
        body: 'Se o chat disser _Tracked as a guest_, você está sendo rastreado mas ainda não está no quadro de membros do clã. Um admin resolve isso sincronizando a lista do clã no jogo —— peça {discordLink}.',
        discordWord: 'no Discord',
      },
    },

    bingo: {
      title: 'Configurações do bingo',
      intro:
        'Só importam enquanto você está num evento. Os padrões estão bons —— aqui está o que cada um realmente faz.',
      figure: {
        caption: 'Configuration → Anvil → Bingo',
        alt: 'A seção Bingo da configuração do plugin com cada opção destacada e numerada',
        legend: [
          {
            label: 'Auto Submit Drops',
            body: 'fotografa e envia um drop rastreado no instante em que ele cai. Deixe ligado; é o sentido de tudo isso.',
          },
          {
            label: 'Show Overlay',
            body: 'desenha um pequeno painel _Anvil / time / data UTC_ no canto superior esquerdo. Ele vira parte da imagem nas suas capturas de prova, e é isso que torna uma prova difícil de falsificar ou retroagir. Está desligado nesta captura —— ligue se o seu clã quer time e horário visíveis em toda prova.',
          },
          {
            label: 'Team completion popups',
            body: 'um banner quando qualquer pessoa do seu time completa uma casa. Várias de uma vez: a mais difícil leva o banner, o resto vai para o chat.',
          },
          {
            label: 'Distinct mission sound',
            body: 'dá um som próprio para uma missão que cai — e para alguém reivindicando uma — para você distinguir de uma casa comum sem olhar.',
          },
          {
            label: 'Banner sound + volume',
            body: 'toca um som junto com o banner. Nada toca até você adicionar pelo menos um .wav, em **Add clip** sob “Banner sounds” no painel lateral do Anvil.',
          },
          {
            label: 'Two-frame drop proof',
            body: 'embute na captura um segundo quadro alguns segundos depois, quando o loot já assentou no chão. Deixe ligado; evita discussão.',
          },
        ],
      },
      startHeading: 'Foto de largada',
      startBody: [
        'Alguns eventos pedem a todos uma **foto de largada**: uma captura tirada depois de o evento começar, num local sorteado no instante da largada. Isso impede que alguém passe a semana anterior estocando clues, baús e kills para despejar no primeiro dia.',
        'Se você usa o plugin, não há nada a preparar. Quando o evento começa você recebe uma linha no chat dizendo aonde ir, e o painel lateral do Anvil mostra um botão **Take starting shot**. Fique onde ele mandar, aperte uma vez e pronto —— o plugin captura o quadro, grava nele seu RSN, o time, o local e uma palavra-chave que só a sua conta recebe, e arquiva por você.',
        'Antes de arquivar qualquer coisa ele confere duas coisas, para você corrigir dentro do jogo e não numa discussão no Discord depois. Se o organizador fixou o ponto no mapa, o plugin sabe a que distância você está e te avisa, em vez de mandar uma foto do outro lado de Gielinor. E se o evento exige uma sessão nova, você precisa **sair e entrar de novo** antes de tirar: seus hiscores só são salvos quando você desloga, então um relog logo antes da foto é o que torna corretos seus totais iniciais —— e, portanto, toda casa de XP e de KC.',
        'No celular, ou sem o plugin: abra **My Team** neste site, leia sua palavra-chave no cartão da foto de largada, digite-a no chat do jogo, tire uma captura do jogo com seu personagem e a palavra-chave visíveis, e envie nesse mesmo cartão. O envio vale na hora —— você pode jogar assim que ele entra, e a staff revisa depois. Se o cartão pedir, saia e entre de novo antes.',
      ],
    },

    notifications: {
      title: 'Notificações no Discord',
      intro:
        'Elas disparam havendo ou não um bingo rolando, e publicam nos canais do clã. Qual canal é decisão dos admins —— você só escolhe _o que_ publica.',
      dropsFigure: {
        caption: 'Mortes e kills · Drops e pets',
        alt: 'As seções de notificação “Deaths and kills” e “Drops and pets” com cada opção destacada e numerada',
        legend: [
          { label: 'Notify on death', body: 'publica no canal de mortes do clã com uma captura do momento em que você morreu.' },
          { label: 'Death message', body: 'sua própria frase. `{name}` é substituído pelo seu RSN.' },
          { label: 'Notify on PvP kill', body: 'uma captura do tick em que seu alvo chega a 0 de HP. Desligado por padrão; ligado aqui.' },
          { label: 'Notify on rare drops', body: 'a chave geral das publicações de drop.' },
          {
            label: 'Min drop value / Min drop rarity',
            body: 'dois caminhos independentes até uma publicação: valer pelo menos tanto (GE ou high alch, o que for maior), ou ser mais raro que 1 em N (1/10.000 por padrão —— ajustes mais frouxos enchem o canal de ervas). Seu clã pode fixar um piso de raridade válido para todos; o seu ainda vale quando for mais rígido. Ponha 0 para desligar um dos caminhos.',
          },
          { label: 'Screenshot rare drops', body: 'anexa a imagem, não só o texto.' },
          {
            label: 'Loot key value',
            body: 'uma loot key publica uma vez só, como uma notificação única, quando todo o seu conteúdo passa desse número.',
          },
          { label: 'Notify on pets + Screenshot pets', body: 'pets vão para o canal de drops raros.' },
        ],
      },
      caFigure: {
        caption: 'Combat achievements · níveis · diaries · quests',
        alt: 'A seção de notificação de Combat achievements com cada opção destacada e numerada',
        legend: [
          { label: 'Notify on combat achievements', body: 'conclusões de tier sempre publicam quando isto está ligado.' },
          {
            label: 'CA task min tier',
            body: 'quão barulhentas são as tarefas individuais concluídas. Aqui Elite; o padrão é Master. Ponha Grandmaster para só as mais raras.',
          },
          { label: 'Notify on 99s & high totals', body: 'os 99, cada 100 níveis de total a partir de 1800, e o max.' },
          { label: 'Notify on diary completions', body: 'tiers de achievement diary.' },
          {
            label: 'Announce quest completions',
            body: 'da dificuldade que você escolher para cima. Aqui “All quests”; o padrão é Master & up.',
          },
        ],
      },
    },

    clips: {
      title: 'Clipes com OBS',
      intro: [
        'Aperte uma tecla e os últimos 30 segundos são salvos e jogados no canal de clipes do clã. Vem desligado e precisa do OBS aberto —— mas é a coisa mais próxima de uma coletânea de melhores momentos que seu clã vai ter.',
        'Como funciona: o OBS mantém um **replay buffer** rolante dos últimos X segundos. Sua tecla manda o OBS despejar esse buffer num arquivo, e o plugin pega o arquivo e o envia para um webhook do Discord que você cola.',
      ],
      privacyNote: {
        tag: 'Para onde vai o seu vídeo',
        body: 'Os clipes sobem **direto do seu PC para o Discord**. Eles nunca passam por este site, e nada é enviado se você deixar o campo do webhook vazio —— os clipes simplesmente ficam na sua máquina.',
      },
      obsHeading: 'A. Configure o OBS (uma vez)',
      obsSteps: [
        'Você precisa do **OBS Studio 28 ou mais novo** —— o servidor WebSocket é embutido a partir da 28, sem download extra.',
        'Garanta que o OBS está mesmo capturando o jogo: uma fonte Game / Window / Display Capture mostrando o RuneLite. Se o OBS não enxerga seu cliente, seus clipes serão um retângulo preto.',
        '**Settings → Output** → marque **Enable Replay Buffer**. (No modo Simple isso fica na página Recording; no Advanced ganha uma aba própria.) Já que está ali, confira se o caminho de gravação tem espaço livre.',
        '**Tools → WebSocket Server Settings** → marque **Enable WebSocket server**. Anote a **Server Port** (4455 por padrão) e clique em **Show Connect Info** para a senha.',
      ],
      obsAside:
        'Você _não_ precisa apertar “Start Replay Buffer” —— o plugin o inicia quando conecta, e reinicia sempre que você muda a duração do clipe.',
      fillHeading: 'B. Preencha o plugin',
      figure: {
        caption: 'Configuration → Anvil → Clips',
        alt: 'A seção Clips da configuração do plugin com cada opção destacada e numerada; o host do OBS e a URL do webhook estão ocultos',
        legend: [
          { label: 'Enable clip capture', body: 'a chave geral. Desligada, o plugin nunca fala com o OBS.' },
          {
            label: 'Capture clip hotkey',
            body: 'defina isto ou nada nunca vai acontecer. Escolha algo que você não aperte sem querer no meio de uma raid.',
          },
          {
            label: 'OBS host / port / password',
            body: '`localhost` quando o OBS roda no mesmo PC do RuneLite. Se o OBS está em outra máquina, ponha o IP local dela aqui —— oculto nesta captura —— e libere a porta no firewall dela. Porta e senha vêm de _Show Connect Info_; deixe a senha em branco se você desligou a autenticação do OBS.',
          },
          {
            label: 'Max auto-post size (MB)',
            body: 'qualquer coisa maior é salva localmente e mencionada discretamente no chat em vez de publicada. Ajuste ao que seu servidor do Discord aceita de fato; o plugin vem com 25.',
          },
          {
            label: 'Clip length (seconds)',
            body: 'quão longe para trás cada clipe alcança. Isso grava a duração do buffer no seu perfil do OBS, então o OBS precisa desses segundos de embalo antes de existir um clipe do tamanho cheio. Clipes maiores = arquivos maiores; 30 é um bom meio-termo.',
          },
          {
            label: 'Save clips as MP4',
            body: 'MP4 pré-visualiza e toca direto no Discord; MKV precisa ser baixado antes. Atenção: isso muda o formato de gravação do OBS, o que afeta também suas gravações normais. Desligue para deixar o OBS em paz.',
          },
          {
            label: 'Clips Discord webhook URL',
            body: 'onde os clipes são publicados —— peça a um admin o webhook do canal de clipes. Vazio = os clipes ficam no seu PC. Oculto aqui, e vale ocultar: quem tiver essa URL pode publicar naquele canal.',
          },
          {
            label: 'Post OBS-triggered clips too',
            body: 'também trata salvamentos disparados pelo próprio OBS ou pelo plugin “Save Replay Buffer for OBS”. Deixe desligado se você roda dois clientes RuneLite contra um único OBS, senão todo clipe é publicado duas vezes.',
          },
        ],
      },
      useHeading: 'C. Use',
      useIntro: 'Acontece algo engraçado → aperte sua tecla → o chat te acompanha:',
      useChat: [
        { text: 'Saving clip...', tone: 'plain' },
        { text: 'Uploading clip to the clan Discord...', tone: 'plain' },
        { text: 'Clip posted to the clan Discord.', tone: 'green' },
      ],
      reminder: {
        tag: 'Lembrete',
        body: 'O clipe cobre os segundos _antes_ de você apertar a tecla —— então aperte depois do momento, não durante. Você tem o tamanho do seu buffer para reagir.',
      },
      decodedHeading: 'As mensagens de clipe, decifradas',
      decoded: [
        {
          term: '`Clip capture: OBS isn’t connected.`',
          body: 'O OBS não está aberto, o servidor WebSocket está desligado, ou host/porta/senha não batem. Corrija e aperte de novo —— o plugin tenta reconectar sozinho a cada 30 segundos.',
        },
        {
          term: '`OBS could not save the clip — is the Replay Buffer started?`',
          body: 'O buffer não está rodando. Confira Enable Replay Buffer nas configurações de saída do OBS, depois desligue e ligue Enable clip capture.',
        },
        {
          term: '`Clip saved locally — paste a Clips Discord webhook URL…`',
          body: 'Funcionando como esperado, você só não tem um webhook configurado. O arquivo está na sua pasta de gravações do OBS.',
        },
        {
          term: '`Clip saved locally (48MB) — too big to auto-post.`',
          body: 'Encurte a duração do clipe, baixe a qualidade de gravação do OBS, ou aumente o tamanho máximo se seu servidor aceita arquivos maiores.',
        },
        {
          term: '`…but Discord didn’t accept the upload.`',
          body: 'Grande demais, rate limit, ou o envio estourou o tempo. O arquivo ainda está no seu PC —— publique na mão se valer a pena.',
        },
      ],
    },

    trouble: {
      title: 'Quando alguma coisa quebra',
      intro:
        'O plugin te avisa no chat quando o rastreamento parou —— ele espera uns 90 segundos antes de reclamar e repete no máximo a cada 5 minutos.',
      rows: [
        {
          term: '`Anvil: your Account Token was rejected — tracking is OFF.`',
          body: 'O token está errado ou foi rotacionado. Copie de novo em [Perfil → RuneLite plugin](/profile#plugin-token), ou limpe o campo e entre pelo plugin outra vez.',
        },
        {
          term: '`Anvil: can’t reach the site — tracking is OFF.`',
          body: 'Confira o Site URL por erros de digitação —— deveria ser `{origin}`. Se estiver certo, o site provavelmente está fora do ar.',
        },
        {
          term: '`…you’re logged in as "<RSN>" but isn’t linked… your drops won’t count.`',
          body: 'Essa conta ainda não está vinculada. Adicione pelo Perfil → “Accounts we noticed you playing”.',
        },
        {
          term: '`Anvil: reconnected — tracking is back on.`',
          body: 'Nada. Ele se recuperou sozinho.',
        },
      ],
      logHeading: 'Ainda travado? Mande um log para um admin',
      logBody:
        'Digite `::anvillog` no chat do jogo (ou defina a **Export debug log hotkey** na seção Support do plugin). Isso grava um arquivo de log na pasta `.runelite/anvil-debug`, abre a pasta e copia o caminho para a área de transferência —— mande esse arquivo a um admin e ele verá exatamente o que deu errado.',
      missingNote: {
        tag: 'Faltando provas?',
        body: 'Pets e Champion’s scrolls repetidos precisam de uma captura manual. O plugin tira para você e salva em `.runelite/osrs-bingo-pending/` — **Copy folder path** no painel lateral do Anvil abre a pasta — então você anexa no site em vez de caçar uma imagem depois.',
      },
    },
  },

  admin: {
    metaTitle: 'Conduzindo seu primeiro evento — guia do admin do Anvil',
    metaDescription:
      'Configure um clã no Anvil e conduza um bingo de ponta a ponta: Discord, sincronização do quadro de membros, tabuleiros, casas, times e draft, largada, e o que acontece depois que o evento termina.',
    eyebrow: 'Anvil · para a staff do clã',
    title: 'Conduzindo seu primeiro evento',
    dek: 'O caminho inteiro, na ordem em que você vai realmente percorrê-lo: deixar {clanName} configurado, trazer o quadro de membros, montar um tabuleiro, formar os times, dar a largada e distribuir os prêmios. Grosso modo o trabalho de uma noite no primeiro bingo —— minutos no segundo.',
    facts: [
      { strong: '4 passos', rest: 'no assistente de configuração' },
      { strong: '7 formatos', rest: 'para montar um tabuleiro' },
      { strong: '1 botão', rest: 'para sincronizar a lista do clã' },
    ],
    footnote:
      'Este guia acompanha o app como ele está hoje. Se alguma tela aqui não bate com a que você está vendo, o app está certo e o guia está velho —— [nos avise](/feedback) e a gente corrige.',

    access: {
      title: 'Quem pode o quê',
      intro:
        'Todo mundo entra com Discord —— não há senhas. O primeiro admin vem da configuração do servidor; depois disso, um admin promove pessoas em **Clan → Members & staff**. Os papéis se acumulam para baixo: tudo o que um moderador pode fazer, um tesoureiro e um admin também podem.',
      rows: [
        {
          term: 'Admin',
          body: 'acesso total —— eventos, casas, times, configurações, staff, premiação. Dê isso ao menor número de pessoas que o clã aguentar.',
        },
        { term: 'Tesoureiro', body: 'tudo o que um moderador pode, mais as taxas de inscrição e a premiação.' },
        {
          term: 'Moderador',
          body: 'o dia a dia: quadro de membros, verificações, competições semanais, calendário, feedback. Não pode criar nem editar eventos.',
        },
        {
          term: 'Editor',
          body: 'apenas a escrita das casas. Conceda de forma geral ou limite a tabuleiros específicos, para que um montador convidado só encoste no evento que você entregou a ele.',
        },
        { term: 'Membro', body: 'joga; nenhuma tela administrativa.' },
      ],
      seeAlso:
        'Dois desses papéis têm página própria: [De plantão]({moderatorGuide}) para o que um moderador realmente faz da noite dele, e [Taxas e premiação]({feesGuide}) para o tesoureiro.',
      ownerNote: {
        tag: 'Dono',
        body: 'Uma conta é a dona. Ninguém mais pode rebaixá-la e é o único papel que pode transferir a propriedade —— então perder uma discussão com um co-admin nunca pode custar seu clã.',
      },
    },

    setup: {
      title: 'Dê nome ao clã, conecte o Discord',
      intro:
        '**System → Setup** é um assistente de quatro passos, e o painel mantém os mesmos quatro como uma lista de conferência até estarem prontos: dar nome ao clã, conectar o Discord, criar um evento, adicionar casas. O status é calculado a partir de dados reais, então um passo só é marcado quando está genuinamente concluído.',
      discord:
        'Para o Discord você tem dois caminhos, e eles se somam: dê ao Anvil um **bot** e ele poderá criar webhooks, sincronizar cargos e apelidos e montar canais privados de time; dê a ele uma única **URL de webhook** e ele poderá publicar anúncios e nada mais. Comece pelo webhook se quer estar no ar em dois minutos, e adicione o bot quando quiser a automação.',
      permsNote: {
        tag: 'Permissões do bot',
        body: 'O bot precisa de _Manage Webhooks_, _Manage Roles_, _Manage Channels_ e _Manage Nicknames_, e o cargo dele precisa ficar _acima_ dos cargos que administra na lista de cargos do seu servidor. Caso contrário o Discord recusa em silêncio.',
      },
      hosted:
        'Num plano hospedado você já viu essa tela uma vez: adicionar o bot durante a configuração foi como o Anvil descobriu qual servidor é o seu, então nunca houve um ID de servidor para copiar. O mesmo link está aqui sempre que você quiser mover o bot para outro servidor.',
    },

    channels: {
      title: 'Divida as publicações entre canais',
      body: [
        'Por padrão tudo cai num único canal principal de anúncios. Quando ele ficar barulhento, abra **System → Advanced settings → Webhooks** e dê às categorias ruidosas casas próprias —— eventos de bingo, competições semanais, drops raros, mortes, kills de PvP, combat achievements, clipes. Tudo que ficar em branco volta para o canal principal, então dá para separar uma categoria por vez.',
        'Com o bot conectado você nunca toca numa URL de webhook: escolhe um canal na lista e aperta **Create webhook**. Num evento movimentado dá para adicionar um segundo webhook ao mesmo canal —— o Anvil alterna entre eles para o limite de taxa do Discord não engolir publicações.',
      ],
      clipsNote: {
        tag: 'O canal de clipes é diferente',
        body: 'Os vídeos de clipe sobem direto do PC de cada jogador para o Discord —— nunca passam por este site. Então o webhook de clipes que você define aqui é o que você _distribui_: os membros colam no plugin deles. Todo o resto desta página é do lado do servidor e os membros nunca veem.',
      },
    },

    roster: {
      title: 'Traga seu quadro de membros',
      body: [
        'A participação no clã vem de um único lugar: uma sincronização da lista do clã no jogo. Instale o [plugin Anvil para RuneLite]({pluginGuide}) na conta de um _admin_, abra a aba **Bingo** do Collection Log no jogo e aperte **Sync clan roster**. Isso manda sua lista real do clã para o site num clique.',
        'Quem vincula ou verifica uma conta no site sem estar nessa lista é um **convidado** —— rastreado, visível, mas não membro até um admin promovê-lo ou a próxima sincronização pegá-lo. Isso é de propósito: significa que ninguém entra sozinho no seu clã digitando um nome.',
        'Você também pode adicionar alguém na mão em **Clan → Members & staff**, inclusive inscrevendo a pessoa num evento em nome dela quando ela não consegue acessar o site.',
      ],
    },

    board: {
      title: 'Crie seu primeiro tabuleiro',
      intro:
        '**Events → All events → New event**. Escolha primeiro um formato —— é ele que decide como o tabuleiro é pontuado e o que o resto do formulário vai te perguntar.',
      formats: {
        classic: { label: 'Bingo clássico', blurb: 'Uma grade quadrada N×N —— os times completam as casas em qualquer ordem, cada uma vale 1.' },
        leagues: { label: 'Bingo Leagues', blurb: 'Uma lista de tarefas em que cada casa carrega um valor em pontos —— qualquer quantidade de casas.' },
        race: { label: 'Corrida de casas', blurb: 'Um percurso ordenado —— os times alcançam as casas em sequência; vence quem chegar mais longe.' },
        showdown: {
          label: 'Showdown',
          blurb:
            'As casas ficam ocultas até o horário marcado —— defina cada horário de abertura na aba Tiles. Por pontos, no estilo DMM All Stars.',
        },
        luckydraw: {
          label: 'Sorteio',
          blurb: 'Um cantador de bingo: casas ocultas entram no ar em sorteios a intervalos fixos. Por pontos.',
        },
        bounty: {
          label: 'Caça à recompensa',
          blurb:
            'Uma casa aberta por vez —— o primeiro time a terminá-la leva os pontos e a próxima recompensa é sorteada.',
        },
        ladder: {
          label: 'Ranking',
          blurb:
            'Uma lista de tarefas por pontos organizada como um ranking individual (times opcionais). As tarefas giram —— progressivas, uma por vez ou numa janela rotativa —— e podem perder valor. No estilo ranking mensal.',
        },
      },
      outro:
        'Depois defina as datas, a janela de inscrição e se as inscrições têm taxa. Comece de um modelo se preferir não partir de uma grade vazia —— a galeria guarda tanto as predefinições embutidas quanto qualquer tabuleiro que você já tenha salvado como modelo.',
      seeAlso:
        'O formato é só metade da decisão —— a outra metade é como as casas viram jogáveis, e as duas se combinam. As duas por inteiro: [Formatos, e como as casas abrem]({formatsGuide}).',
      utcNote: {
        tag: 'As datas são em UTC',
        body: 'Todo horário no Anvil é guardado e comparado em UTC, e exibido no fuso local de quem visita. Defina o horário de término que você quer de verdade; o site vai mostrar a um britânico e a um australiano dois relógios diferentes para o mesmo instante.',
      },
    },

    tiles: {
      title: 'Preencha o tabuleiro',
      body: [
        'A aba **Tiles** do evento é onde um tabuleiro vira um bingo. Cada casa é um único _tipo_ de tarefa, e o tipo decide o que o plugin observa: um drop, um killcount de boss, XP de skill, a morte de um NPC, uma conclusão cronometrada, um achievement diary, um Combat Achievement, um desbloqueio no Collection Log, um kill de PvP, um ganho de inventário ou uma run sem mortes. Casas manuais —— as que uma pessoa verifica por captura —— também são sempre uma opção.',
        'Para um tabuleiro inteiro, escreva em massa: exporte a planilha, preencha num editor de planilhas e importe de volta. CSV e .xlsx fazem a volta completa, e as linhas correspondem às posições, então dá para reescrever uma grade inteira de 25 casas com um único colar.',
      ],
      rows: [
        {
          term: 'Faixas de dificuldade',
          body: 'os valores em pontos se mapeiam em faixas nomeadas (easy → elite). Edite as faixas em Advanced settings se seu clã classifica de outro jeito.',
        },
        {
          term: 'Auditor de equilíbrio',
          body: 'confere um tabuleiro pronto em busca de problemas estruturais e esforço desequilibrado antes de os jogadores verem.',
        },
        {
          term: 'Oculto até a revelação',
          body: 'tabuleiros novos começam ocultos. A staff sempre vê; os jogadores não veem nada até você revelar —— então dá para montar um tabuleiro à vista de todos sem estragar a surpresa.',
        },
      ],
      seeAlso:
        'Que tipo escolher, como escrever duzentas casas numa planilha, e os erros que importam limpo e depois nunca disparam: [Um tabuleiro que se registra sozinho]({boardGuide}).',
    },

    teams: {
      title: 'Times e o draft',
      body: [
        'A aba **Teams & Draft** se adapta ao formato escolhido: um formato que não usa times passa direto por ela. Num bingo de times normal você cria os times, decide quem capitaneia e ou distribui os jogadores você mesmo ou conduz um draft ao vivo.',
        'Os capitães escolhem do pool de inscritos na ordem que você definiu, e cada capitão vê as respostas dadas no formulário de inscrição —— congeladas como foram enviadas, para ninguém editar suas “horas por semana” depois de ser escolhido.',
      ],
      lockNote: {
        tag: 'O draft trava a formação',
        body: 'Assim que um draft começa, o conjunto de times e a ordem de escolha ficam congelados. Adicione o time que você esqueceu _antes_ de apertar iniciar, não depois.',
      },
      seeAlso:
        'Mande aos seus capitães [o guia do capitão]({captainGuide}) antes da noite do draft —— a sala de guerra é mais útil nos dias anteriores, e ninguém lê uma tela nova com um relógio correndo.',
      visitingClans:
        'Vão jogar contra outro clã em vez de fazer draft interno? Um time visitante escala o próprio elenco por um único link, e o moderador deles toca isso sem uma conta de admin aqui —— veja [Recebendo um clã visitante]({clanVsClanGuide}).',
    },

    launch: {
      title: 'Dê a largada e conduza',
      body: [
        'Revele as casas e depois inicie o evento. O Anvil se recusa a iniciar um tabuleiro que não está pronto —— um draft ainda rolando, ou jogadores sem time —— e te diz qual é o caso. Se você sabe o que está fazendo (um amistoso, uma reprise, um tabuleiro de teste), dá para forçar.',
        'Daí em diante ele quase se conduz sozinho. O plugin credita automaticamente tudo o que enxerga e publica capturas de prova gravadas com o time e um horário UTC. O que sobra no seu colo é:',
      ],
      rows: [
        {
          term: 'Envios para verificar',
          body: 'casas manuais e tudo o que o plugin sinalizou. Aprove ou recuse com a prova na sua frente.',
        },
        {
          term: 'Estatísticas',
          body: 'a aba Stats do evento mostra a contribuição de cada jogador —— útil quando um time discute quem carregou quem.',
        },
        {
          term: 'Anúncios',
          body: 'System → Announce publica uma mensagem nos seus canais no meio do evento, sem você escrever um webhook na mão.',
        },
      ],
      missionNote: {
        tag: 'Surpresas no meio do evento',
        body: 'Você pode soltar uma **missão** num bingo em andamento —— uma casa bônus oculta que é anunciada quando você a dispara, opcionalmente perdendo valor ou expirando. É o jeito mais barato de acordar um tabuleiro no quinto dia.',
      },
      startProofNote: {
        tag: 'Impedindo o estoque pré-evento',
        body: [
          'Ligue a **foto de largada** (evento → Overview) e todo jogador terá de entregar uma captura tirada depois de o evento começar, num local que o Anvil sorteia no instante da largada —— assim ninguém chega no T0 sentado em cima de uma semana de clues e baús guardados. O local é anunciado junto com a largada; a palavra-chave de cada jogador é pessoal, deriva do sorteio e não existe antes de o evento começar, então ninguém consegue preparar isso com antecedência.',
          'Fixe os pontos no mapa-múndi (o editor do conjunto tem um) e o plugin confere se os jogadores estão mesmo ali, em vez de apenas mandar. Você também pode exigir uma **sessão nova** —— 15 minutos por padrão: os hiscores só são salvos quando o jogador desloga, então fazer todo mundo relogar logo antes da foto é o que torna honestos os totais iniciais por trás de cada casa de XP e de KC.',
          'Quem usa o plugin aperta um botão. Todos os outros digitam a palavra-chave no jogo e enviam em My Team. Você escolhe o que acontece com um crédito de quem não entregou: sinalizar para revisão (padrão) ou recusar até entregar. O mesmo painel do Overview é a lista de revisão —— capturas do plugin com palavra-chave verificada chegam já aceitas, então na prática você só olha os jogadores de celular.',
        ],
      },
    },

    after: {
      title: 'Depois da última casa',
      intro:
        'Quando o tempo acaba o tabuleiro congela e o evento é travado —— pontos, contribuições e quem-fez-o-quê ficam como estavam. Se você precisar corrigir algo depois, um admin pode destravá-lo deliberadamente.',
      rows: [
        {
          term: 'Premiação',
          body: 'a aba Payouts do evento transforma o bolo numa lista de quem recebe o quê, marcada conforme você paga.',
        },
        {
          term: 'Retrospectiva',
          body: 'uma página pública com a classificação final e os prêmios de fim de evento —— maior drop, mais kills e o resto.',
        },
        {
          term: 'Pesquisa',
          body: 'pergunte ao clã o que acharam. Monte na aba Survey; os jogadores respondem depois do fim e só a staff vê os resultados.',
        },
        {
          term: 'Salvar como modelo',
          body: 'guarde o tabuleiro que você acabou de montar. O próximo bingo começa dele em vez de uma grade vazia.',
        },
      ],
      federation:
        'Com a federação ligada, os membros também podem se conectar a outros clãs Anvil pelo plugin —— útil para eventos entre clãs, e totalmente opcional para cada membro.',
      outro: 'Depois aponte seus membros para o [guia de configuração do jogador]({pluginGuide}) e comece a planejar o próximo.',
    },
  },

  clanVsClan: {
    metaTitle: 'Recebendo um clã visitante — guia do anfitrião no Anvil',
    metaDescription:
      'Conduza um clã contra clã no Anvil: dê a cada clã visitante um link de convite que senta os jogadores dele num único time, e um assento de staff para o moderador deles tocar a própria metade.',
    eyebrow: 'Anvil · para quem recebe',
    title: 'Recebendo um clã visitante',
    dek: 'Você recebe o tabuleiro; eles escalam o elenco. Este é o caminho que evita coletar uma dúzia de RSNs no privado —— um link por time, e um assento que deixa o moderador deles tocar a metade deles do evento.',
    facts: [
      { strong: '1 link', rest: 'por time visitante' },
      { strong: '0 assentos de admin', rest: 'entregues a estranhos' },
      { strong: '~5 min', rest: 'por clã que você convida' },
    ],
    footnote:
      'As capturas vêm de uma instalação real num tabuleiro de teste —— os tokens de convite e os nomes do Discord estão borrados. Um link de verdade merece cuidado: quem estiver com ele pode ocupar um lugar naquele time enquanto ele viver.',

    shape: {
      title: 'O que você está preparando',
      body: [
        'Um clã contra clã é um evento comum com uma diferença: metade dos jogadores não é do seu clã e nunca será. Eles não podem entrar por sincronização da lista, você não quer promovê-los e certamente não quer inscrever vinte na mão e depois arrastar cada um para o time certo.',
        'Duas peças resolvem isso, e são independentes —— use uma, ou as duas.',
      ],
      rows: [
        {
          term: 'Um link de convite',
          body: 'uma URL que você gera uma vez para um time. Quem abrir entra, preenche o formulário normal de inscrição e cai naquele time já aprovado —— sem pool de draft, sem fila de aprovação.',
        },
        {
          term: 'Um assento na staff do time',
          body: 'uma pessoa nomeada que pode tocar _aquele único time_ —— o elenco dele, os envios e provas dele, as taxas dele —— sem uma conta de admin aqui, e sem tirar o posto de capitão de quem está de fato jogando.',
        },
      ],
      note: {
        tag: 'O que um convite não é',
        body: 'Não é um login e não é um atalho que pula a verificação. Quem abrir ainda entra com Discord e ainda precisa de um RSN verificado, exatamente como qualquer outra inscrição. As únicas coisas que o link decide são _em qual time_ a inscrição entra e que ela não precisa da aprovação de ninguém.',
      },
    },

    team: {
      title: 'Crie o time primeiro',
      body: [
        'Abra seu evento e vá até a aba **Teams & Draft**. Crie um time para cada clã convidado e dê o nome deles —— o nome é o que os jogadores deles veem no formulário de inscrição, então “Ironforge” é melhor que “Team 2”.',
        'Você _não_ precisa conduzir um draft. Links de convite e draft são alternativas: um draft distribui um pool comum de inscritos, um link senta as pessoas diretamente. Num clã contra clã puro a maioria dos anfitriões cria os times, entrega um link para cada e nunca abre o draft.',
        'Depois abra o time em si —— **Teams & Draft → o time** —— que é onde moram os dois passos seguintes.',
      ],
      captainNote: {
        tag: 'Capitão primeiro',
        body: 'Nomeie o capitão do time visitante antes de entregar o link, para que a página do time tenha um responsável desde o começo. Nomear um capitão também o senta no time; se o cartão avisar que ele não está na lista, aceite a correção oferecida.',
      },
    },

    staff: {
      title: 'Dê um assento ao moderador deles',
      body: [
        'O painel **Team staff** na página do time é como o moderador do clã visitante começa a trabalhar sem você conceder nada a ele no seu site. Aperte **Add someone**, procure a pessoa, adicione uma observação tipo “mod do Ironforge” para o próximo admin saber por que ela está ali, e aperte **Give a seat**.',
      ],
      figure: {
        caption: 'Evento → Teams & Draft → o time → Team staff',
        alt: 'O painel Team staff com um assento concedido e a busca “add someone” aberta',
        legend: [
          {
            label: 'Add someone',
            body: 'abre a busca. Só aparecem pessoas que já entraram aqui com Discord pelo menos uma vez —— veja a nota abaixo.',
          },
          {
            label: 'A observação',
            body: 'texto livre, 120 caracteres. Escreva de qual clã a pessoa é. Assentos sobrevivem ao evento na lista, e “quem é essa pessoa” é a pergunta que você vai ter daqui a três meses.',
          },
          {
            label: 'Remove',
            body: 'tira o assento na hora. Faça isso quando o evento acabar —— um assento não tem prazo automático.',
          },
        ],
      },
      canDo: 'O que um assento pode fazer, só naquele time:',
      canDoList: [
        'ver e administrar o elenco do time',
        'cuidar dos envios e provas dele',
        'marcar as taxas dos jogadores dele como pagas',
        'gerar links de convite para ele, se você habilitar (dois passos adiante)',
      ],
      cantDo: 'O que ele nunca pode fazer:',
      cantDoList: [
        'encostar em qualquer outro time',
        'editar o tabuleiro ou suas casas',
        'fazer escolhas no draft',
        'substituir alguém depois que o evento está no ar',
      ],
      note: {
        tag: 'Eles precisam entrar aqui uma vez antes',
        body: 'A busca só lista contas com um Discord vinculado —— um assento fica preso a uma pessoa que consegue de fato entrar. Então mande o moderador visitante a este site, peça que aperte **Login** uma vez, e _aí_ conceda o assento. Se ele não aparece na busca, esse login ainda não aconteceu.',
      },
    },

    link: {
      title: 'Gere o link de convite',
      body: [
        'Ainda na página do time, o painel **Invite links** cria o link. Dois campos decidem o que o link promete, e nos dois `0` quer dizer “não prometo nada”.',
      ],
      figure: {
        caption: 'Evento → Teams & Draft → o time → Invite links',
        alt: 'O painel Invite links com os campos de vagas e validade, o botão Make a link e um link ativo listado',
        legend: [
          {
            label: 'Vagas e validade',
            body: 'quantas pessoas o link pode sentar (até 100) e por quanto tempo ele continua valendo (até 30 dias). Ponha as vagas no tamanho do elenco que eles prometeram e o link se fecha sozinho quando todos entrarem; ponha uma validade quando o link for para um Discord público. `0` em qualquer um dos campos significa sem limite.',
          },
          {
            label: 'Make a link',
            body: 'gera e já copia para a área de transferência. Cole para eles antes de fazer qualquer outra coisa.',
          },
          {
            label: 'A lista ativa',
            body: 'todo link que este time tem por aí, com quantos entraram e quantas vagas sobram. **Copy** pega de novo; **Turn off** o mata de vez.',
          },
        ],
      },
      shape: 'O link fica assim: `{origin}/events/{eventId}/join/{token}` —— uma linha só, tranquila de colar numa mensagem do Discord.',
      note: {
        tag: 'Padrões sensatos',
        body: 'Para um clã contra clã em que você combinou o elenco com um único moderador, deixe os dois campos em `0` e deixe que ele toque. Recorra a vagas e validade quando o link for para um lugar que você não controla.',
      },
      revoke:
        'Desligar um link é imediato e não remove ninguém que já entrou —— eles agora são jogadores comuns daquele time. Para tirar alguém, use o elenco do time.',
    },

    captains: {
      title: 'Deixe que gerem os próprios links',
      body: [
        'Por padrão só um anfitrião pode criar links, e um capitão que tenta é avisado. Esse padrão é o certo para um evento normal de clã —— um capitão distribuindo vagas estaria preenchendo um elenco que ninguém aprovou —— e é errado para um clã contra clã, onde o lado visitante conhece o próprio elenco melhor que você.',
        'A chave está no mesmo painel **Invite links**: **Let captains make their own links**. Ela vale para _todo time deste evento_, não só o que você está olhando, que é justamente o que se quer quando os dois lados são clãs visitantes.',
        'Com ela ligada, o capitão do time e qualquer pessoa com assento de staff podem gerar links em **My Team → Invite links**. Eles recebem o mesmo painel que você, menos a chave.',
      ],
      figure: {
        caption: 'My Team → o time → Invite links',
        alt: 'A aba Invite links do lado do capitão no hub do time, com os campos de vagas e validade e um link ativo',
        legend: [
          {
            label: 'Mesmo painel, visão do capitão',
            body: 'gerar, copiar, desligar. Se o anfitrião não ligou a chave, aparece “Only a host can make links for this event” e os campos somem.',
          },
          {
            label: 'A lista ativa',
            body: 'um capitão que não pode gerar ainda vê os links que o time dele tem por aí —— assim ele pode te pedir outro em vez de supor que não existe nenhum.',
          },
        ],
      },
    },

    player: {
      title: 'O que os jogadores deles veem',
      intro: 'Vale percorrer você mesmo uma vez antes de entregar o link, para saber responder às perguntas.',
      steps: [
        'Eles abrem o link. Se não estiverem logados, entram com Discord primeiro e voltam direto —— o link não se perde no caminho.',
        'Caem no formulário normal de inscrição, com uma faixa dizendo **You’re joining {teamExample} by invite**. Mesmas perguntas, mesmo seletor de conta, mesma taxa de qualquer outra pessoa.',
        'Ao enviar, estão naquele time, aprovados. Nenhuma ação do anfitrião, nenhum draft.',
      ],
      figure: {
        caption: 'O formulário de inscrição, aberto por um link de convite',
        alt: 'O formulário de inscrição do evento com uma faixa dizendo que o jogador está entrando num time nomeado por convite',
        legend: [
          {
            label: 'A faixa do convite',
            body: 'nomeia o time em que estão prestes a entrar. Se nomeia o time errado, o link é o errado —— pare e confira antes de enviar.',
          },
          {
            label: 'O resto do formulário',
            body: 'inalterado. Um RSN verificado ainda é exigido, as perguntas de inscrição continuam sendo feitas, e a taxa de inscrição continua valendo.',
          },
        ],
      },
      note: {
        tag: 'Já se inscreveu?',
        body: 'Se alguém se inscreveu normalmente antes e está no pool, abrir o link move a pessoa para o time em vez de criar uma segunda inscrição. Quem já foi aprovado em outro time fica onde está —— mova pelo elenco.',
      },
    },

    dead: {
      title: 'Quando um link para de funcionar',
      intro:
        'Um link recusado se explica na página em vez de dar 404, então quem está com ele consegue te dizer qual destes é o caso.',
      rows: [
        {
          term: 'This invite has been turned off.',
          body: 'Alguém apertou **Turn off**. Gere um novo —— um link antigo nunca volta.',
        },
        {
          term: 'This invite has expired.',
          body: 'Bateu nas horas que você definiu. Gere outro, desta vez com `0` horas se a validade não está valendo a pena.',
        },
        {
          term: 'This invite is full.',
          body: 'Todas as vagas foram ocupadas. Aumente gerando um link novo com mais vagas —— o número de vagas é fixo assim que o link existe.',
        },
        {
          term: 'Sign-ups for this event aren’t open.',
          body: 'O único que pode se resolver sozinho. Confira a janela de inscrição do evento: já abriu, o prazo passou, ou o evento já começou.',
        },
        {
          term: 'That invite belongs to a different event.',
          body: 'Colaram um link de outro tabuleiro. Confira se o id do evento na URL é o que você queria.',
        },
      ],
      checklist: 'Antes do evento, percorra esta lista uma vez por clã visitante:',
      checklistItems: [
        'o time deles existe e leva o nome deles',
        'o capitão deles está nomeado e sentado no time',
        'o moderador deles entrou aqui e tem um assento de staff',
        'o link está gerado, copiado e entregue de fato a uma pessoa',
        'a janela de inscrição está aberta pelo tempo de que eles precisam',
      ],
      note: {
        tag: 'Quando acabar',
        body: 'Desligue os links e remova os assentos de staff. Nenhum dos dois expira sozinho, e um link vivo num evento encerrado é só uma ponta solta.',
      },
    },
  },

  board: {
    metaTitle: 'Montando um tabuleiro — guia de escrita de casas do Anvil',
    metaDescription:
      'Escreva casas de bingo que se creditam sozinhas: o que cada tipo de casa realmente enxerga, escrita em massa por planilha, e os erros que falham em silêncio.',
    eyebrow: 'Anvil · para quem monta tabuleiros',
    title: 'Um tabuleiro que se registra sozinho',
    dek: 'Uma casa é a promessa de que algo será notado. Isto é o que cada tipo realmente enxerga, como escrever duzentas sem perder sua noite, e o punhado de erros que falham em silêncio —— a casa simplesmente nunca dispara, e ninguém descobre até o quarto dia.',
    facts: [
      { strong: '15 tipos', rest: 'um por casa, nunca misturados' },
      { strong: '1000 casas', rest: 'por tabuleiro, via planilha' },
      { strong: 'Em silêncio', rest: 'é como uma casa ruim falha' },
    ],
    footnote:
      'O formato da planilha está especificado por inteiro em `docs/tile-authoring.md`, escrito para quem (ou o que) estiver gerando as linhas. Esta página é a metade humana: que tipo escolher, e o que dá errado.',

    kinds: {
      title: 'Uma casa, um tipo',
      body: [
        'Toda casa é exatamente um _tipo_, e o tipo é a questão inteira: ele decide o que o plugin ou a varredura dos hiscores observa e, portanto, se a casa pode se completar sozinha. Misturar campos de dois tipos é recusado na porta, em vez de aceito e deixado quebrado.',
        'Os tipos se dividem em três famílias, e a família importa mais que o rótulo:',
      ],
      families: [
        {
          term: 'Manual',
          body: 'uma pessoa olha uma captura e diz que sim. Sempre disponível, sempre funciona, sempre custa a noite de alguém. Use para o que o software não consegue ver.',
        },
        {
          term: 'Lido dos hiscores',
          body: 'XP de skill e killcount de boss, lidos dos Hiscores oficiais numa varredura a cada 15 minutos. Não precisa de plugin, funciona para todo mundo na lista —— mas só enxerga o que os Hiscores rastreiam, e só depois que o jogador desloga.',
        },
        {
          term: 'Detectado pelo plugin',
          body: 'todo o resto: drops, mortes de NPC, conclusões cronometradas, diaries, combat tasks, voltas, valor de loot. Credita em segundos e grava uma captura de prova —— mas só para quem está de fato rodando o plugin.',
        },
      ],
      kindsIntro: 'A lista completa, na ordem em que o seletor os oferece:',
      kindLabels: {
        standard: { label: 'Padrão', blurb: 'Casa manual —— um capitão marca como feita. Sem rastreamento automático.' },
        skill: { label: 'Skill', blurb: 'Completa sozinha quando uma skill atinge uma meta de XP (lido dos hiscores).' },
        boss: { label: 'KC de boss', blurb: 'Completa sozinha quando um boss atinge uma meta de killcount (lido dos hiscores).' },
        drop: { label: 'Drop', blurb: 'N drops de um item (ou qualquer um de um conjunto) —— detectado pelo plugin, com captura gravada.' },
        collection: { label: 'Conjunto de itens', blurb: 'Vários itens, cada um com a própria quantidade exigida —— 1× de cada para o conjunto completo.' },
        kill: { label: 'Killcount', blurb: 'N mortes de um NPC —— até dos que nunca estiveram nos hiscores (galinhas, vacas). Detectado pelo plugin.' },
        lap: { label: 'Voltas de agility', blurb: 'N voltas numa pista de agility, ou N andares / runs completas do Hallowed Sepulchre —— contadas ao vivo pelo contador do jogo. Só valem as voltas feitas durante o evento.' },
        pvp: { label: 'Kill de PvP', blurb: 'Mate jogadores —— qualquer um, times rivais ou um alvo nomeado —— na Wild ou em mundos PvP. Minigames seguros nunca contam.' },
        gain: { label: 'Itens obtidos', blurb: 'Pesque/cozinhe/colete N de um item —— contados pelos ganhos de inventário. Detectado pelo plugin.' },
        timed: { label: 'Cronometrada', blurb: 'Conclua uma atividade dentro de um limite de tempo (Inferno, raids, Colosseum). O plugin cronometra.' },
        deathless: { label: 'Sem mortes', blurb: 'Conclua uma raid com ZERO mortes no grupo, N vezes. O plugin conta as mortes na instância.' },
        lms: { label: 'LMS', blurb: 'Fique entre os N primeiros no Last Man Standing (1 = vitória), M vezes. Detectado pelo plugin no fim da partida.' },
        value: { label: 'Valor do loot', blurb: 'Loot valendo X gp —— uma coleta só ou coletas somando até uma meta. O plugin precifica a coleta.' },
        diary: { label: 'Diary', blurb: 'Conclua tiers de achievement diary durante o evento. Detectado pelo plugin na mensagem de conclusão.' },
        ca: { label: 'Combat task', blurb: 'Conclua tarefas de Combat Achievement durante o evento. Detectado pelo plugin na mensagem de conclusão.' },
      },
      note: {
        tag: 'A pergunta do plugin, feita uma vez',
        body: 'Uma casa detectada pelo plugin é invisível para quem não roda o plugin. Isso não é um bug que se contorne com configuração —— não há nada observando. Se uma parte do seu clã joga no celular ou no cliente oficial, ou mantenha essas casas fora do caminho crítico para a vitória, ou combine-as com uma alternativa manual e conte com verificar capturas.',
      },
    },

    pick: {
      title: 'Escolha o tipo que vai realmente disparar',
      intro:
        'Quase toda casa mal-comportada é a ideia certa expressa no tipo errado. As quatro que pegam as pessoas:',
      rows: [
        {
          term: 'Uma meta de KC de boss',
          body: '**não** é uma casa de kill. Casas de kill observam mortes de NPC pelo plugin; uma meta de KC é um número dos hiscores e precisa de `trackedStat` + `statType=boss` + `statGoal`. Use uma casa de kill para o que os Hiscores nunca contaram —— vacas, galinhas, um mob específico de slayer.',
        },
        {
          term: 'Um slot do Collection Log',
          body: 'é uma casa de drop. Desbloquear a entrada no log credita, então a casa dispara mesmo numa repetida que o jogador já tinha —— que normalmente é o que você quis dizer.',
        },
        {
          term: '“Pegue um de cada”',
          body: 'é uma casa de drop com uma lista de itens e **sem** `requiredAmount`. Adicione um `requiredAmount` e ela vira, em silêncio, “pegue quaisquer N destes” —— a mesma linha, uma casa completamente diferente.',
        },
        {
          term: 'Um diary ou combat task',
          body: 'só credita pela mensagem de conclusão no jogo, que aparece no instante em que o tier ou a tarefa é concluída. O que o jogador já tem não pode disparar de novo —— exceto uma combat task, em que **Settings → Combat Achievements → Repeat completion** permite disparar outra vez.',
        },
      ],
      note: {
        tag: 'Casas de boss compostas',
        body: 'A estatística rastreada de uma casa de boss pode conter várias chaves dos Hiscores separadas por vírgula, e os ganhos se somam. `chambersOfXeric,chambersOfXericChallengeMode` é uma casa só que conta CoX e CM juntos, que é quase sempre o que uma casa de raid quer dizer.',
      },
    },

    bulk: {
      title: 'Escreva em massa, não no navegador',
      body: [
        'Clicar uma grade de 25 casas tudo bem. Clicar um tabuleiro Leagues de 200 tarefas não, e revisar depois também não. A aba Tiles tem uma volta completa feita exatamente para isso.',
      ],
      steps: [
        '**Download spreadsheet** na aba **Tiles** do evento. Você recebe um .xlsx do tabuleiro como ele está, com listas suspensas, a lista de itens e as instruções das colunas em abas próprias.',
        'Edite. Uma linha por casa; a ordem das linhas é a ordem das casas.',
        '**Upload CSV / Excel** na mesma aba. Só a aba **Tiles** é lida.',
      ],
      rules: [
        {
          term: 'A volta não perde nada',
          body: 'baixe e reenvie sem mudanças e nada acontece —— linhas iguais são relatadas como inalteradas e nem sequer regravadas. Isso torna a exportação segura como backup antes de uma edição grande.',
        },
        {
          term: 'As linhas se mapeiam por posição',
          body: 'a linha 1 é a casa 1. Casas existentes são atualizadas no lugar, e uma coluna que você omitir fica intocada em vez de apagada —— então dá para enviar uma planilha de duas colunas que só edita pontos.',
        },
        {
          term: 'Só tabuleiros dinâmicos crescem',
          body: 'linhas extras criam casas novas num tabuleiro Leagues ou numa corrida de casas, antes de o evento começar, até 1000. Uma grade clássica N×N tem formato fixo e as ignora. Para gerar centenas de tarefas, faça um evento Leagues.',
        },
        {
          term: 'Tudo ou nada',
          body: 'toda linha é validada primeiro. Um único nome de item irresolvível derruba a importação inteira, lista os culpados e não muda nada —— você nunca fica com meio tabuleiro.',
        },
        {
          term: 'Alguns campos travam na largada',
          body: 'rótulo, tipo, quantidade exigida e configuração de itens só são aplicados antes de o evento começar. Descrição, pontos, categoria e a marca de opcional continuam editáveis o tempo todo, então dá para corrigir um erro de digitação no meio do evento sem reabrir o tabuleiro.',
        },
      ],
    },

    traps: {
      title: 'Os erros que falham em silêncio',
      intro:
        'Cada um destes importa limpo, fica no tabuleiro com cara de correto, e nunca dispara. Vale lê-los antes de enviar, não depois.',
      rows: [
        {
          term: 'Casas de skill e de boss são `type=standard`',
          body: 'não existe `type=skill`. O tipo vem de `trackedStat` + `statType` + `statGoal` numa linha por outro lado padrão. Escrever `type=boss` é recusado; escrever `type=standard` e esquecer as colunas da estatística não é —— você fica com uma casa manual que ninguém jamais vai aprovar.',
        },
        {
          term: 'Os separadores mudam conforme a coluna',
          body: '`items` usa ponto e vírgula (a vírgula é o delimitador do CSV). `targetNpcs` usa barra vertical. Numa linha de combat task a barra vertical é a **única** opção, porque os nomes reais das tarefas contêm vírgulas —— `Nylocas, On the Rocks` é uma tarefa só.',
        },
        {
          term: 'Nomes de raid são comparados literalmente',
          body: 'uma casa de raid sem mortes ou cronometrada carrega o modo escrito como no jogo: `Chambers of Xeric: Challenge Mode`, `Theatre of Blood: Hard Mode`, `Tombs of Amascut: Expert Mode`. Uma grafia quase certa é uma casa que nunca se completa. Conclusões em Entry Mode nunca creditam uma casa da raid base; modos mais difíceis creditam.',
        },
        {
          term: 'Nomes de itens têm de ser exatos',
          body: 'grafia do jogo, ou a importação falha e lista o que não conseguiu resolver. Quando um nome é ambíguo, fixe como `Nome#id` e pare de adivinhar.',
        },
        {
          term: '`timeThresholdSeconds` significa quatro coisas',
          body: 'um limite de tempo numa casa cronometrada, um limite de colocação numa casa de LMS (1 = vitória), o tamanho exato do grupo numa casa sem mortes, e o tamanho exato do grupo de raid numa casa de drop. Mesma coluna, quatro sentidos —— confira se está preenchendo o que o seu tipo realmente lê.',
        },
        {
          term: 'Uma quantidade exigida no tipo errado',
          body: 'ela pertence às linhas de drop, kill, gain, lap, PvP, sem mortes e LMS. Numa linha de estatística ou cronometrada não faz nada, e numa linha de drop transforma um conjunto de itens num pool de “quaisquer N”.',
        },
      ],
      note: {
        tag: 'Teste uma antes de escrever duzentas',
        body: 'Escreva uma única casa do tipo sobre o qual você tem dúvida, revele num evento descartável e vá fazer a coisa. Cinco minutos ali valem mais do que descobrir, na noite do bingo do clã, que uma categoria inteira estava morta.',
      },
    },

    points: {
      title: 'Pontos, faixas e se está justo',
      body: [
        'Num tabuleiro pontuado cada casa carrega o próprio valor, e esses valores se mapeiam em faixas de dificuldade nomeadas —— de easy a elite —— que você pode editar em **Advanced settings** se o seu clã classifica de outro jeito. A faixa é o que os jogadores leem; o número é o que pontua.',
        'Marque uma casa como **opcional** e ela deixa de contar para o total do tabuleiro —— é assim que se adicionam metas extras sem tornar o blackout impossível.',
        'Quando o tabuleiro estiver cheio, rode o **auditor de equilíbrio** na aba Tiles. Ele confere a estrutura e a distribuição de esforço e te diz onde o tabuleiro está torto —— uma categoria que ninguém consegue fechar, uma faixa que vale muito mais por hora que as vizinhas —— antes que os jogadores achem isso por você e contornem.',
      ],
    },

    reveal: {
      title: 'Ninguém vê até você mandar',
      body: [
        'Tabuleiros novos começam ocultos. A staff sempre vê; os jogadores não veem absolutamente nada até você revelar —— então um tabuleiro pode ser montado à vista, por dias, num canal que seus membros leem, sem estragar nada.',
        'Essa chave geral é o piso de todo o resto. Num tabuleiro com política de revelação —— agendada, por intervalo, por recompensa, rotativa —— o motor só começa a virar casas individuais depois que o próprio tabuleiro foi revelado, então armar um tabuleiro é sempre um ato deliberado. Qual política escolher tem página própria: [Formatos, e como as casas abrem]({formatsGuide}).',
        'As missões são a exceção que vale conhecer: casas escritas antes mas seguradas, anunciadas no meio do evento a partir do próprio conjunto enquanto o resto do tabuleiro segue visível.',
      ],
    },

    check: {
      title: 'Antes de revelar',
      intro: 'Vale percorrer uma vez por tabuleiro. Quase tudo são cinco minutos.',
      items: [
        'cada casa tem o tipo que você quis, não o tipo que importou limpo',
        'modos de raid, nomes de itens e nomes de tarefas batem com a grafia do jogo caractere por caractere',
        'as casas detectadas pelo plugin não são o único caminho para vencer, se parte do clã joga sem ele',
        'os pontos estão definidos e o auditor de equilíbrio está satisfeito —— ou você discorda dele de propósito',
        'as casas opcionais estão marcadas como opcionais',
        'você baixou a planilha uma vez, como um backup que dá para reenviar',
      ],
      note: {
        tag: 'Quem pode fazer isso',
        body: 'Escrever o tabuleiro é o único trabalho de admin com papel próprio. Um **editor** pode escrever casas e nada mais, e pode ser limitado a tabuleiros específicos —— então um montador convidado de outro clã recebe exatamente o evento que você entregou e nenhum acesso a mais nada do que você conduz.',
      },
    },
  },

  captain: {
    metaTitle: 'Guia do capitão — Anvil',
    metaDescription:
      'O dia do draft e as semanas seguintes: ler o pool antes de o relógio começar, fazer as escolhas, e tocar o elenco, as provas e as taxas do seu time.',
    eyebrow: 'Anvil · para capitães',
    title: 'Guia do capitão',
    dek: 'Você recebe uma sala de guerra, um relógio e os formulários de inscrição de vinte e cinco desconhecidos. Isto é o que tudo isso faz, na ordem em que você encontra —— mais as partes de tocar um time que só começam depois que o draft acaba.',
    facts: [
      { strong: 'Ordem serpentina', rest: 'para as escolhas tardias se equilibrarem' },
      { strong: 'O relógio', rest: 'nunca escolhe por você' },
      { strong: 'Uma aba', rest: 'toca seu time o evento inteiro' },
    ],
    footnote:
      'Tudo aqui é o que um capitão vê. Taxas, elencos de outros times e o tabuleiro antes da revelação são da staff e continuam assim, então nada nesta página vai fazer você ser acusado de olhar o que não devia.',

    before: {
      title: 'O que você recebe, e quando',
      body: [
        'Um anfitrião te nomeia capitão, e isso faz duas coisas: te senta no time como jogador e abre as telas do time para você. Se a página do time avisar que você não está no elenco, aceite a correção oferecida —— um capitão fora do próprio time é um estado que confunde todas as telas seguintes.',
        'Daí em diante você tem dois lugares. **My Team** é o hub do seu time, e é onde você passa o evento. A **sala de guerra** é a tela do dia do draft, e abre assim que as inscrições abrem —— bem antes da noite do draft.',
      ],
      note: {
        tag: 'Entre cedo',
        body: 'A sala de guerra é mais útil nos dias _antes_ do draft, quando você consegue ler cada formulário direito. Na noite ela vira um cronômetro e você não terá tempo de ler nada.',
      },
    },

    warroom: {
      title: 'Leia o pool antes de o relógio começar',
      body: [
        'A sala de guerra mostra todo mundo que pode ser escolhido, com tudo o que o site sabe sobre cada um: o que jogam, os bosses em que têm killcounts reais, em quantos eventos passados apareceram, e as respostas que deram no formulário de inscrição.',
        'Essas respostas estão **congeladas como foram enviadas**. Ninguém edita suas “horas por semana” depois de ver quem foi escolhido primeiro, e é exatamente por isso que elas valem a leitura.',
        'Monte uma **lista curta** enquanto lê. Ela é sua, sobrevive até a noite do draft, e na noite é a diferença entre escolher de uma lista em que você já confia e escolher quem estiver no topo da tela.',
      ],
      rows: [
        {
          term: 'Nota e faixa',
          body: 'um resumo do que a pessoa realmente fez, derivado do histórico da conta e não do que ela te contou. Indicativo —— é o ponto de partida de uma conversa, não um veredito.',
        },
        {
          term: 'Áreas e marcadores',
          body: 'o que elas comprovadamente fazem: raids, PvM, skilling, PvP. Útil para achar o buraco no seu elenco em vez de pegar o número mais alto quatro vezes.',
        },
        {
          term: 'Presença',
          body: 'com que frequência terminaram eventos passados em que se inscreveram. O número mais discreto da página e muitas vezes o mais preditivo.',
        },
      ],
    },

    draft: {
      title: 'O dia do draft',
      body: [
        'As escolhas seguem a **ordem serpentina**: com quatro times a primeira rodada vai A, B, C, D e a segunda vai D, C, B, A, então escolher por último numa rodada significa escolher primeiro na seguinte. Quem tirou a primeira escolha paga por ela um minuto depois.',
        'Uma pessoa é uma escolha, não uma conta. Pegar alguém puxa junto todas as contas que ela registrou —— você nunca gasta uma segunda escolha na alt de alguém.',
      ],
      rows: [
        {
          term: 'O relógio de escolha',
          body: 'se o anfitrião definiu um, você tem aqueles segundos por vez. Quando ele estoura, ele **não** escolhe por você —— libera o anfitrião para escolher em seu nome, e diz isso nas duas telas. Nada acontece em silêncio.',
        },
        {
          term: 'Uma lista reduzida',
          body: 'alguns eventos rodam em modo de equilíbrio. Dependendo de qual, o time mais forte pode ficar impedido de pegar outro jogador da faixa mais alta enquanto um rival não tem nenhum, ou ter um teto de quanto o elenco dele pode ficar acima da média. Se alguém que você queria está cinza, é por isso, e vale para todo mundo.',
        },
        {
          term: 'Se você não puder estar lá',
          body: 'avise o anfitrião antes. Ele pode escolher por você na mesma tela, e a lista curta que você deixou é a instrução que ele vai seguir.',
        },
      ],
      note: {
        tag: 'O elenco trava quando o draft começa',
        body: 'Com um draft em andamento, o conjunto de times e a ordem de escolha ficam congelados. Se falta um time ou a ordem está errada, isso tem de ser corrigido antes da primeira escolha, não depois.',
      },
    },

    roster: {
      title: 'O hub do seu time, o evento inteiro',
      intro:
        'Em **My Team**, o cartão **Manage this team** guarda tudo o que você pode fazer pelo seu lado. Ele vem recolhido; abra uma vez e ele fica como você deixou.',
      rows: [
        {
          term: 'Roster',
          body: 'quem está no time e o que cada um contribuiu. O primeiro lugar para olhar quando alguém pergunta por que o drop dele não contou —— uma conta não vinculada aparece aqui.',
        },
        {
          term: 'Requests',
          body: 'gente pedindo para entrar, em eventos que deixam os jogadores escolherem o time. Só aparece quando há pedidos.',
        },
        {
          term: 'Proof',
          body: 'os envios do seu time e as capturas deles. Você não é quem aprova no fim —— a staff é —— mas você vê o que foi mandado e pode cobrar o que não foi.',
        },
        {
          term: 'Fees',
          body: 'quem no seu time ainda deve a taxa de inscrição. Você pode marcar uma como paga; confirmar é trabalho da staff, de propósito.',
        },
        {
          term: 'Invite links',
          body: 'aparece quando o anfitrião permitiu que capitães gerem os próprios. Um link senta quem o abrir direto no seu time. Veja [Recebendo um clã visitante]({clanVsClanGuide}) para o que o link realmente faz.',
        },
      ],
    },

    during: {
      title: 'Tocando depois da largada',
      body: [
        'A maior parte do evento se toca sozinha: o plugin credita o que enxerga e arquiva uma captura carimbada. O que sobra são as pessoas, e esse é o trabalho.',
        'As coisas que realmente precisam de um capitão: garantir que todo mundo do seu lado esteja com o plugin conectado e as contas vinculadas antes do apito, porque uma alt não vinculada não contribui para nada; perceber, na metade do caminho, quais casas ninguém encostou; e fazer com que as casas manuais sejam fotografadas antes da última hora, quando todo mundo tenta ao mesmo tempo.',
        'Se o evento pede foto de largada, essa é a única coisa que cada jogador precisa fazer sozinho nas primeiras horas. Cobre cedo —— quem não entregar tem todo crédito sinalizado, ou recusado de vez, dependendo de como o anfitrião configurou.',
      ],
      note: {
        tag: 'Substituições',
        body: 'Com o evento no ar, trocar alguém é só para admins, de propósito: as contribuições já estão presas a pessoas. Pergunte a um anfitrião em vez de dar um jeito por fora.',
      },
    },
  },

  formats: {
    metaTitle: 'Formatos e como as casas abrem — Anvil',
    metaDescription:
      'Os sete formatos de evento, as cinco maneiras de as casas abrirem, e os modificadores de pontuação —— o que cada um faz com a sensação de jogar um evento.',
    eyebrow: 'Anvil · para a staff do clã',
    title: 'Formatos, e como as casas abrem',
    dek: 'Duas decisões moldam um evento mais do que qualquer casa dentro dele: qual é o formato do tabuleiro, e como as casas viram jogáveis. Elas são independentes —— qualquer formato aceita qualquer política de revelação —— e juntas são a diferença entre uma semana de moagem e uma corrida de uma noite.',
    facts: [
      { strong: '7 formatos', rest: 'o formato do tabuleiro' },
      { strong: '5 políticas', rest: 'como as casas abrem' },
      { strong: '3 modificadores', rest: 'quanto vale uma conclusão' },
    ],
    footnote:
      'O formato é fixado na criação mas pode ser mudado depois na aba Overview do evento; a política de revelação e os modificadores de pontuação podem ser mudados a qualquer momento antes de as casas afetadas serem reveladas.',

    shape: {
      title: 'O formato do tabuleiro',
      intro:
        'O formato decide como o tabuleiro é pontuado e o que o formulário de criação pergunta em seguida. Todo o resto desta página se monta em cima disso.',
      note: {
        tag: 'Grade fixa ou lista de tarefas',
        body: 'Um tabuleiro **clássico** é um quadrado de verdade, então “N igual a 5” significa exatamente 25 casas e essa conta nunca muda. Todo o resto é uma lista de tarefas de qualquer tamanho, que também é o único tipo de tabuleiro que uma importação em massa consegue fazer crescer. Se você vai gerar cem tarefas, essa decisão é tomada bem aqui.',
      },
    },

    reveal: {
      title: 'Como as casas abrem',
      intro:
        'Independente do formato. A chave de revelação no nível do evento continua sendo o portão principal —— enquanto o tabuleiro está oculto nada é visível e nenhum destes motores roda, então armar um tabuleiro é sempre deliberado.',
      rows: [
        {
          term: 'Tudo de uma vez',
          body: 'o clássico. Toda casa é jogável no instante em que você revela o tabuleiro, e os times escolhem a própria ordem. Escolha isto a menos que tenha um motivo para não.',
        },
        {
          term: 'Agendada',
          body: 'cada casa carrega o próprio horário de revelação, definido na aba Tiles, e entra no ar quando esse horário passa. Um tabuleiro de “uma casa por hora”: dita o ritmo por você e exige os horários escritos antes.',
        },
        {
          term: 'Por intervalo',
          body: 'o motor sorteia casas ocultas em intervalos fixos —— um lote a cada N minutos, aleatório ou na ordem do tabuleiro. Um cantador de bingo. Zero trabalho além das próprias casas, e o tabuleiro se revela enquanto você dorme.',
        },
        {
          term: 'Recompensa',
          body: 'exatamente uma casa aberta por vez, e o primeiro time a terminá-la fica com ela —— a casa fecha e a próxima é sorteada na hora. Impiedoso, ótimo de assistir, e sem dó com fusos horários.',
        },
        {
          term: 'Rotativa',
          body: 'uma janela deslizante com algumas casas abertas: cada sorteio abre novas e expira as mais antigas. Diferente da recompensa, todo mundo consegue concluir uma casa aberta antes de ela sumir. Feita para rankings individuais.',
        },
      ],
      note: {
        tag: 'A questão do fuso horário',
        body: 'Tabuleiros de recompensa e por intervalo premiam quem por acaso está acordado. Num clã espalhado pelo mundo, isso é uma vantagem real distribuída pelo relógio e não pelo jogo. Janelas rotativas suavizam isso —— uma casa aberta continua aberta por toda a janela, então quem está dormindo ainda tem chance.',
      },
    },

    scoring: {
      title: 'Quanto vale uma conclusão',
      intro:
        'Três modificadores, todos só no modo por pontos, todos congelados na conclusão no instante em que ela acontece —— então uma mudança posterior nunca reescreve o passado.',
      rows: [
        {
          term: 'Bônus de primeiro time',
          body: 'pontos extras para o primeiro time a terminar cada casa. O jeito mais barato de fazer um tabuleiro todo visível parecer uma corrida sem mudar mais nada.',
        },
        {
          term: 'Desvalorização',
          body: 'o valor de uma casa varia linearmente do cheio na revelação até uma porcentagem-alvo após N horas, e então se mantém. Abaixo de 100% ela cai e premia a corrida; acima de 100% ela **cresce**, o que premia limpar as tarefas velhas que todo mundo pulou. A direção crescente é a que as pessoas esquecem que existe.',
        },
        {
          term: 'Exclusividade',
          body: 'a primeira conclusão fecha a casa para todos os outros. Implícita no modo recompensa. Num tabuleiro com muita diferença de força entre times isso pode encerrar a disputa cedo —— funciona melhor quando os times estão parelhos.',
        },
      ],
    },

    missions: {
      title: 'Missões: surpresas no meio do evento',
      body: [
        'Missões são casas escritas antes e seguradas —— anunciadas a partir do próprio conjunto enquanto o resto do tabuleiro segue visível. Elas são independentes da política de revelação, então até um bingo comum todo visível pode ter.',
        'Solte-as na mão quando o tabuleiro esfriar, em intervalo fixo, ou numa agenda por missão. Cada missão carrega a própria pontuação: exclusividade, bônus, desvalorização e expiração próprios, definidos por casa e não pelo evento.',
        'São o jeito mais barato de acordar um tabuleiro no quinto dia, que é o dia em que todo evento longo precisa ser acordado.',
      ],
    },

    choose: {
      title: 'Escolhendo, em uma página',
      intro: 'Se você já sabe a sensação que quer, este é o caminho mais curto até ela.',
      rows: [
        { term: 'Um bingo de clã normal', body: 'Grade clássica, todas as casas visíveis. Adicione um bônus de primeiro time se quiser um pouco de pressa.' },
        { term: 'Centenas de tarefas, pontuadas por dificuldade', body: 'Leagues, tudo visível. É também o único formato em que uma importação grande de planilha consegue crescer.' },
        { term: 'Uma semana que vai crescendo', body: 'Leagues com revelação agendada ou por intervalo, para o tabuleiro abrir ao longo da semana em vez de tudo de uma vez.' },
        { term: 'Uma noite que as pessoas assistem ao vivo', body: 'Recompensa. Uma casa, o primeiro time leva, próxima casa na hora.' },
        { term: 'Uma disputa individual, não de times', body: 'Ranking com janela rotativa e desvalorização. As tarefas vêm e vão e ninguém consegue guardá-las.' },
        { term: 'Uma corrida com linha de chegada', body: 'Corrida de casas —— um percurso ordenado, e vence quem chegar mais longe.' },
      ],
      outro:
        'Escolha o que escolher, as casas em si são o mesmo trabalho: veja [Um tabuleiro que se registra sozinho]({boardGuide}).',
    },
  },

  fees: {
    metaTitle: 'Taxas e premiação — guia do tesoureiro do Anvil',
    metaDescription:
      'Cobrar uma taxa de inscrição, recebê-la, a segunda assinatura que a encerra, e transformar o bolo de prêmios em colocações pagas.',
    eyebrow: 'Anvil · para tesoureiros',
    title: 'Taxas e premiação',
    dek: 'Dinheiro é onde eventos de clã dão errado, e dão errado em silêncio: uma taxa que alguém jura ter pago, um bolo que ninguém consegue conciliar, uma divisão de prêmio discutida depois que os vencedores deslogaram. Este é o caminho que deixa registro em cada passo.',
    facts: [
      { strong: '2 assinaturas', rest: 'encerram uma taxa, por padrão' },
      { strong: 'Bolo = adicionado', rest: '+ taxa × inscrições aprovadas' },
      { strong: '1 linha', rest: 'por pessoa paga' },
    ],
    footnote:
      'Taxas e premiação são a área do tesoureiro. Um tesoureiro pode tudo o que um moderador pode, mais isto; um moderador pode marcar uma taxa como recebida mas nunca encerrá-la.',

    set: {
      title: 'Definindo a taxa',
      body: [
        'A taxa de inscrição vive no evento, definida quando você o cria ou editada na aba **Sign-ups**. Nenhuma taxa é uma resposta perfeitamente boa —— muitos eventos rodam só com um bolo colocado pelo anfitrião.',
        'Duas configurações decidem o que a taxa realmente significa, e é fácil passar batido:',
      ],
      rows: [
        {
          term: 'Por pessoa ou por conta',
          body: 'num evento em que as pessoas podem inscrever várias contas, isto decide se pagam uma vez ou uma vez por conta. Erre e você vai estar devolvendo dinheiro.',
        },
        {
          term: 'Prazo de pagamento',
          body: 'quando ele passa, inscrições não pagas deixam de ser um problema para correr atrás e viram uma decisão. Coloque mais cedo do que você acha —— a véspera do evento é tarde demais para substituir alguém.',
        },
      ],
      note: {
        tag: 'O bolo acompanha as inscrições',
        body: 'O bolo mostrado é o que você acrescentou na mão, mais a taxa de inscrição vezes o número de inscrições **aprovadas**. Ele se mexe conforme inscrições são aprovadas e excluídas, então o número na página é sempre o que você conseguiria pagar de fato.',
      },
    },

    collect: {
      title: 'Recebendo',
      body: [
        'As taxas são recebidas do jeito que seu clã já recebe dinheiro —— no jogo, no Discord, como vocês fizerem. O trabalho do Anvil começa no instante em que ela chega: alguém com acesso de staff marca como **paid**, e isso carimba quem diz ter recebido e quando.',
        'Os jogadores também têm voz. Um membro pode informar a quem pagou e anexar uma captura, e é isso que transforma “eu com certeza paguei” num registro com dois lados. Quando o relato do jogador e a alegação de quem recebeu apontam pessoas diferentes, isso é uma divergência que o site consegue te mostrar, em vez de uma que você descobre no meio de uma briga.',
      ],
      note: {
        tag: 'A prova é apagada de propósito',
        body: 'Uma captura de pagamento é guardada só até a taxa ser encerrada, e então removida. Ela existe para resolver um desacordo, não para ficar arquivada por um ano.',
      },
    },

    sign: {
      title: 'A segunda assinatura',
      body: [
        'Uma taxa fica em **collected** até que um membro da staff _diferente_ confirme que ela chegou. Quem mexeu no dinheiro não pode ser também quem assina que ele chegou —— esse é todo o controle, e é por isso que o site recusa a confirmação do próprio recebedor em vez de apenas desencorajá-la.',
        'Quantas assinaturas uma taxa exige é uma configuração do clã, de zero a cinco. O zero existe por um motivo real: num clã em que o tesoureiro _é_ o dono, não há mais ninguém para assinar, e “34 taxas esperando uma segunda assinatura” vira uma fila que nunca pode ser esvaziada e permanentemente a coisa mais barulhenta do painel. No zero, marcar uma taxa como paga **é** a assinatura.',
        'Coloque em um —— o padrão —— se vocês são duas pessoas. Coloque em zero se honestamente não são, e aumente só se o seu clã tem tanto a staff quanto o motivo.',
      ],
    },

    pay: {
      title: 'Pagando',
      body: [
        'Quando o evento termina, a aba **Payouts** do evento transforma o bolo numa lista de pessoas. Gere-a e você tem uma linha por recebedor, não por time: o prêmio de um time vencedor se divide igualmente entre seus membros, para que pagar seja uma lista de nomes e números em vez de um problema de aritmética à meia-noite.',
        'Os valores partem de uma divisão sugerida —— pesada no topo, e quanto mais colocações pagas você define, mais plana ela fica —— e toda linha é editável. A sugestão é um ponto de partida, não uma política.',
        'Depois é pagar, marcando as linhas conforme avança. A questão é que uma semana depois qualquer um possa olhar a lista e ver quem recebeu quanto, em vez de reconstruir isso pelo histórico do Discord.',
      ],
      note: {
        tag: 'Anuncie uma vez, daqui',
        body: 'A premiação é publicada nos seus canais do Discord a partir do próprio evento, então o anúncio e o registro são a mesma coisa. Um prêmio anunciado na mão é um prêmio que alguém depois vai dizer que nunca chegou.',
      },
    },

    disputes: {
      title: 'Quando os números não batem',
      intro: 'Os quatro que você vai encontrar de verdade:',
      rows: [
        {
          term: 'Dizem que pagaram, ninguém marcou',
          body: 'peça que informem o pagamento com uma captura. Isso coloca no registro um recebedor nomeado e um horário, e a pessoa apontada pode confirmar ou negar.',
        },
        {
          term: 'Duas pessoas da staff acham que receberam',
          body: 'o relato do próprio jogador é o desempate —— ele diz a quem entregou. Corrija o recebedor e então encerre.',
        },
        {
          term: 'Uma taxa está parada esperando assinatura',
          body: 'ou ela está genuinamente esperando outra pessoa, ou seu clã tem menos staff do que a configuração de confirmações exigidas supõe. Baixe a configuração em vez de confirmar o próprio recebimento.',
        },
        {
          term: 'O bolo mudou depois que você avisou',
          body: 'ele acompanha as inscrições aprovadas, então aprovar ou excluir uma inscrição o move. Cite o bolo no momento em que as inscrições fecham, não no momento em que abrem.',
        },
      ],
    },
  },

  moderator: {
    metaTitle: 'De plantão — guia do moderador do Anvil',
    metaDescription:
      'O dia de um moderador num site de clã Anvil: a fila, verificar envios e contas, manter o quadro de membros honesto, e as decisões a tomar.',
    eyebrow: 'Anvil · para moderadores',
    title: 'De plantão',
    dek: 'Um moderador faz o trabalho que chega havendo ou não um evento rolando: provas para olhar, contas para verificar, um quadro de membros que desanda. Isto é do que a fila é feita, e como esvaziá-la sem virar o motivo pelo qual as pessoas esperam.',
    facts: [
      { strong: 'Nada de eventos', rest: 'um moderador não cria nem edita' },
      { strong: 'Uma página', rest: 'diz o que precisa de você' },
      { strong: 'Aprove rápido', rest: 'fila lenta parece site quebrado' },
    ],
    footnote:
      'Um moderador vê tudo o que um membro vê mais as telas de revisão. Criar e editar eventos, configurações, staff e premiação são trabalho de admin e de tesoureiro —— se um botão não está lá, é por isso, e é de propósito.',

    what: {
      title: 'O que o papel é',
      intro:
        'Os papéis se acumulam para baixo: tudo o que um moderador pode fazer, um tesoureiro e um admin também podem. O que é especificamente do moderador:',
      canList: [
        'o quadro de membros: sincronizar, adicionar pessoas, promover um convidado',
        'verificações de conta —— o desafio de XP e a revisão manual',
        'envios e capturas de prova',
        'competições semanais e o calendário',
        'feedback dos membros',
      ],
      cantIntro: 'O que ele não pode fazer, de propósito:',
      cantList: [
        'criar ou editar um evento, ou suas casas',
        'mudar configurações do clã ou a ligação com o Discord',
        'promover alguém, ou mexer na staff',
        'encerrar uma taxa ou rodar uma premiação',
      ],
    },

    queue: {
      title: 'Comece pelo que precisa de você',
      body: [
        'O painel administrativo não é um resumo do site —— é uma lista do que está esperando, ordenada pelo quanto importa, calculada a partir de dados reais e não de contadores que desandam. Se ele diz que nada precisa de você, nada precisa.',
        'Trabalhe de cima para baixo. Os itens que sobem ao topo são os que têm uma pessoa do outro lado: alguém que não consegue se inscrever porque a conta não está verificada, ou cujo drop não contou porque ninguém olhou ainda.',
      ],
    },

    submissions: {
      title: 'Envios e provas',
      body: [
        'A maior parte dos créditos nunca chega até você: o plugin vê o drop, arquiva uma captura carimbada com o time e um horário UTC, e a casa se completa. O que cai na fila são as casas manuais e o que o plugin sinalizou.',
        'É o carimbo que torna uma prova difícil de contestar. Uma captura do plugin traz o time e o instante gravados na imagem, e com a prova de dois quadros ligada um segundo quadro alguns segundos depois mostra o loot já no chão. Uma captura sem nada disso é uma captura de celular, e tudo bem —— só significa que quem confere é você.',
      ],
      rows: [
        {
          term: 'Aprove quando for plausível',
          body: 'você não está auditando um banco. Se a imagem mostra a coisa, a conta está no quadro de membros e o horário cai dentro do evento, aprove e siga em frente.',
        },
        {
          term: 'Recuse com um motivo',
          body: 'uma recusa sem explicação volta como mensagem privada para você dentro de uma hora. Diga o que faltou para a segunda tentativa vir certa.',
        },
        {
          term: 'Um envio sinalizado é uma pergunta, não uma acusação',
          body: 'o plugin sinaliza o que não conseguiu confirmar por inteiro —— na maioria das vezes um jogador que não entregou a foto de largada. Leia como “olhe este aqui”, e não como “alguém trapaceou”.',
        },
      ],
    },

    verify: {
      title: 'Verificando contas',
      intro:
        'Ninguém consegue se inscrever num evento sem pelo menos uma conta verificada, então esta fila bloqueia gente de jogar diretamente. É a que vale esvaziar todo dia.',
      rows: [
        {
          term: 'Verificada pelo plugin',
          body: 'o caso mais comum, e não exige nada de você. Jogar a conta com o plugin conectado a vincula automaticamente, e uma impressão digital estável da conta faz o vínculo sobreviver a uma troca de nome.',
        },
        {
          term: 'Verify by XP',
          body: 'para jogadores sem o plugin. O site sorteia uma skill e eles ganham 1.000 XP nela em trinta minutos. Se resolve sozinho —— você só vê as que falham.',
        },
        {
          term: 'Revisão manual',
          body: 'Hiscores ocultos, ou uma alt nova demais para aparecer neles. Alguém envia um RSN com uma observação e você decide. Peça uma captura da tela de login se a observação não bastar.',
        },
      ],
      note: {
        tag: 'Verificado não é membro',
        body: 'Verificar uma conta diz “esta é mesmo dela”. Não coloca a pessoa no clã —— a participação no clã vem só de uma sincronização da lista do clã no jogo ou de um admin adicionando na mão. Quem está verificado mas não está na lista é um **convidado**: rastreado, visível, e não membro. Isso é de propósito, e é o que impede qualquer um de entrar no seu clã digitando um nome.',
      },
    },

    roster: {
      title: 'Mantendo o quadro de membros fiel',
      body: [
        'O quadro de membros vem de um único lugar: um admin roda uma sincronização da lista do clã no jogo, pelo botão **Anvil** na barra de título da janela do clã (ou **Sync roster** no painel lateral do plugin). Todo o resto —— verificações, vínculos, inscrições —— pende disso.',
        'Então a manutenção é pequena mas real: rode a sincronização depois de cada rodada de recrutamento, promova os convidados que de fato entraram, e olhe as pessoas que o site sinalizou como precisando de revisão em vez de esperar que reclamem.',
      ],
      note: {
        tag: 'Visto por último não é jogou por último',
        body: 'O horário de “visto por último no clã” de um membro registra a última sincronização que o encontrou, não o último login. Para “ele ainda joga?”, olhe o horário das estatísticas ao vivo —— é o que se move sozinho.',
      },
    },

    startshot: {
      title: 'Revisando fotos de largada',
      body: [
        'Num evento que a exige, todo jogador precisa entregar uma captura tirada depois de o evento começar, num local sorteado no instante da largada. Capturas do plugin com palavra-chave verificada chegam já aceitas, então na prática você só olha os jogadores que enviaram na mão pelo celular.',
        'O que você confere é pouco: o personagem está na imagem, a palavra-chave está no chat, e é a palavra-chave que aquele jogador realmente recebeu. Os envios contam na hora e a revisão é depois, então ninguém fica impedido de jogar enquanto espera por você.',
      ],
    },

    judgement: {
      title: 'As decisões que você vai ter de tomar',
      intro:
        'Nenhuma delas tem resposta certa em software, e é por isso que chegam a uma pessoa.',
      rows: [
        {
          term: 'A prova é real mas atrasada',
          body: 'o drop aconteceu dentro do evento e a captura veio depois do fim. Normalmente aprove —— olhe o carimbo na imagem, não o horário do envio.',
        },
        {
          term: 'A conta ainda não está vinculada',
          body: 'o drop é legítimo, a conta é da pessoa, só não foi adicionada antes de ela jogar. Faça vincular e então aprove. Não faça ninguém refazer uma raid por causa de papelada.',
        },
        {
          term: 'Parece armado',
          body: 'leve a um admin em vez de recusar você mesmo. Uma recusa dentro de um clã pequeno é uma acusação pública, e nunca deveria ser a decisão apressada de uma pessoa só.',
        },
        {
          term: 'Você está no evento',
          body: 'quase certamente está. Passe qualquer coisa que envolva seu próprio time para outro moderador —— não porque você seria injusto, mas porque você não deveria ter de provar que não foi.',
        },
      ],
    },
  },
};

export default ptBr;
