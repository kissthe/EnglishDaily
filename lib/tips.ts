// 各部分的做题技巧。内容按北京中考题型整理，学生在“做题技巧”页和做题页的“技巧”按钮中查看。
export type TipBlock=
 |{type:'steps';title:string;items:{title:string;text:string}[]}
 |{type:'table';title:string;note?:string;headers:string[];rows:string[][]}
 |{type:'list';title:string;items:string[]}
 |{type:'compare';title:string;items:{wrong:string;right:string;why:string}[]};
export type TipSection={id:TipSectionId;title:string;tagline:string;blocks:TipBlock[]};
export type TipSectionId='retell'|'reading'|'grammar'|'writing'|'vocabulary';

export const tipSections:TipSection[]=[
 {id:'retell',title:'听后转述',tagline:'1 分钟看导图 → 听 3 遍记笔记 → 2 分钟组句 → 用给定开头说出来',blocks:[
  {type:'steps',title:'考场四步',items:[
   {title:'听前 1 分钟：画骨架',text:'按导图分支在草稿纸上分好区，每区留两行。看清开头句，在角上写下人称（we / he / she）和时态（will / 过去式 / 一般现在时）。'},
   {title:'第 1 遍：抓主干',text:'每个分支先记“动词 + 关键名词”，例如 pick strawberries、send video。'},
   {title:'第 2 遍：补细节',text:'补时间、地点、数字、价格、原因。听到数字立刻写阿拉伯数字。'},
   {title:'第 3 遍：查漏',text:'只核对空着或打问号的地方，注意 and / but / not 这类改变意思的词。'},
   {title:'准备 2 分钟：连成句',text:'每个要点说成一个简单完整句，分支之间加连接词。不要临时造长难句。'},
   {title:'录音：稳输出',text:'第一句一字不差读开头句；语速每分钟约 100 词；说错了直接重说，不要长时间停顿。'}]},
  {type:'table',title:'速记缩写清单',note:'自己看得懂就行，中文单字也可以，比如“赛”“图书馆→图”。',headers:['类别','写法','意思'],rows:[
   ['星期','Mon Tue Wed Thu Fri Sat Sun','周一 … 周日'],
   ['月份','Jan Feb Mar Apr Aug Sept Oct Nov Dec','一月 … 十二月'],
   ['时间','am / pm · tmr · nxt wk · lst wk · 2day','上午/下午 · 明天 · 下周 · 上周 · 今天'],
   ['时间','b4 · aft · → 3:30','before · after · 到 3:30'],
   ['地点','sch · lib · mus · hosp · gym · pk · hall','学校 图书馆 博物馆 医院 体育馆 公园 礼堂'],
   ['人','stu · tchr · ppl · bro · sis · grandpa','学生 老师 人们 兄弟 姐妹 爷爷'],
   ['活动','comp · prog · exh · trip · vol','比赛 项目 展览 出游 志愿'],
   ['符号','& · w/ · w/o · → · =','and · with · without · go to / lead to · is / means'],
   ['符号','↑ · ↓ · × · √ · ?','更多/增加 · 减少 · 不要/禁止 · 应该/要 · 没听清'],
   ['符号','$ · # · ! · ≈','价格/钱 · 数量/号码 · 重要 · 大约'],
   ['词尾','-ing → g · -tion → n · -ment → mt','visiting → visitg · competition → competn']]},
  {type:'table',title:'人称与时态怎么转',headers:['原文说的','转述时说','例子'],rows:[
   ['you（对听众）','we / you（全文统一）','You should bring water. → We should bring water.'],
   ['I / my（说话人自己）','he / she / his / her','I made a card. → Tom made a card.'],
   ['our school / our class','保持 our','Our class will visit… → Our class will visit…'],
   ['通知、计划、活动安排','一般将来时 will / be going to','We will meet at the gate at 8:00.'],
   ['讲过去的经历','一般过去时','Last Sunday was Grandma’s birthday.'],
   ['介绍地方、人物、规则','一般现在时（注意三单 -s）','The library opens at 8:00. He works hard.']]},
  {type:'list',title:'连接词和兜底句',items:['按顺序：First, … Then, … After that, … Finally, …','补充信息：Besides, … / What’s more, … / Also, …','规则提醒：We should… / We mustn’t… / Please remember to…','没听清动词时兜底：have / take part in / go to / visit / There will be…','结尾可选一句：It will be a great chance to… / I’m sure we will have a good time.']},
  {type:'list',title:'常见失分',items:['漏掉导图的一个分支：准备时对照导图逐条打勾。','人称前后打架：开头用 we，全文就用 we。','只念关键词不成句：每个要点至少有主语 + 谓语。','时态混乱：通知类句句检查有没有 will。','没读开头句或读错：开头句是给分点，一字不改。']}]},
 {id:'reading',title:'阅读理解',tagline:'先看题，带着问题读；答案一定能在原文找到依据',blocks:[
  {type:'steps',title:'做题顺序',items:[
   {title:'先看题干',text:'圈出题干里的人名、数字、时间和关键名词，判断题型。'},
   {title:'快读全文',text:'第一遍读懂大意：写了谁、什么事、作者态度。每段首句往往是中心句。'},
   {title:'回原文定位',text:'用题干关键词找到原句，读它前后各一句。'},
   {title:'比对选项',text:'正确项常是原文的同义改写；和原文字面完全一样的选项反而要小心。'}]},
  {type:'table',title:'题型和方法',headers:['题型','常见问法','方法'],rows:[
   ['细节题','According to the passage… / Which is TRUE?','定位原句，找同义替换。'],
   ['主旨题','What’s the main idea? / The best title is…','看首尾段和反复出现的词；不能太宽也不能太窄。'],
   ['推断题','We can infer that… / The writer probably…','以原文为依据，只往前推一步，不过度引申。'],
   ['词义猜测','The underlined word “…” means…','看前后句的解释、举例、转折；把选项代回原句读通。'],
   ['代词指代','What does “it / they” refer to?','往前找最近的、单复数一致的名词，代回检验。'],
   ['态度目的','The writer wrote this to… / feels…','看作者用的形容词、副词和结尾句。']]},
  {type:'list',title:'干扰项五种样子',items:['偷换概念：词都在原文里，但对象或关系换了。','以偏概全：原文说 some，选项说 all / always。','无中生有：原文没提到，只是常识上对。','正反颠倒：漏看了 not / never / hardly。','过度推断：比原文多推了好几步。']}]},
 {id:'grammar',title:'语法选择',tagline:'看空格成分 → 找线索词 → 代入通读',blocks:[
  {type:'steps',title:'解题三步',items:[
   {title:'看空格在句中做什么',text:'缺主语？缺谓语？还是修饰名词？成分决定词性和形式。'},
   {title:'找线索',text:'时间状语、主句时态、and / but / so 前后的逻辑、上下文对话。'},
   {title:'代入通读',text:'把选项放回句子读一遍，检查时态、单复数和固定搭配。'}]},
  {type:'table',title:'时态信号词',headers:['看到','多半用','例子'],rows:[
   ['always / usually / every day','一般现在时','She usually walks to school.'],
   ['yesterday / ago / last… / in 2020','一般过去时','We visited the museum last week.'],
   ['tomorrow / next… / in + 一段时间','一般将来时','He will come back in three days.'],
   ['now / Look! / Listen!','现在进行时','Listen! Someone is singing.'],
   ['already / yet / ever / never / since / for / so far','现在完成时','I have lived here since 2015.'],
   ['at this time yesterday / when + 过去动作','过去进行时','I was reading when he called.'],
   ['by the end of last… / 比另一个过去动作更早','过去完成时','The film had started when we arrived.']]},
  {type:'table',title:'非谓语常用动词',headers:['后面接','常见动词'],rows:[
   ['doing','enjoy · finish · mind · practise · keep · be busy · spend time (in) · feel like'],
   ['to do','want · hope · decide · plan · agree · would like · forget/remember（还没做）'],
   ['do（不带 to）','let · make · have · see/hear sb. do（全过程）· had better · Why not'],
   ['意思不同','stop doing 停止正在做 / stop to do 停下来去做；remember doing 记得做过 / remember to do 记得要做']]},
  {type:'list',title:'高频易错点',items:['主将从现：if / when / as soon as 引导的从句用一般现在时表将来。','宾语从句用陈述语序：Can you tell me where the library is?','感叹句：What + (a/an) + 形容词 + 名词！ How + 形容词/副词！','反意疑问句：前肯后否、前否后肯；助动词跟着前句。','被动语态：be + 过去分词，be 跟着时态变。','定语从句只用 that：先行词有 all / the only / 最高级 / 序数词，或人和物并列。']}]},
 {id:'writing',title:'书面表达',tagline:'审题三要素 → 三段式 → 自查清单',blocks:[
  {type:'steps',title:'动笔前',items:[
   {title:'圈出三要素',text:'人称（写给谁、以谁的身份）、时态（经历用过去时，建议用现在时或将来时）、要点（数清楚有几个）。'},
   {title:'列提纲',text:'每个要点写 2–3 个关键词，再决定先后顺序。'},
   {title:'控制字数',text:'中考一般要求不少于 50 词，写到 80–100 词最稳。'}]},
  {type:'table',title:'三段式结构',headers:['段落','写什么','可用句子'],rows:[
   ['开头','点题，一两句说明写什么','I’d like to share… / Here is my plan for…'],
   ['主体','逐条写要点，每点再加一个细节或例子','First, … For example, … What’s more, …'],
   ['结尾','感受、收获或呼吁','I’m sure… / In a word, … / Let’s… together!']]},
  {type:'list',title:'加分表达',items:['不仅…而且：not only… but also…','让某人做某事：It helps me (to) … / It makes me feel…','给建议：It’s a good idea to… / You’d better…','表达感受：I was so excited that… / I will never forget…','总结：In a word, … / All in all, …']},
  {type:'list',title:'交卷前自查',items:['要点齐全，没有漏掉题目的任何一问。','时态统一，第三人称单数加了 -s。','主谓一致、名词单复数正确。','句首大写、句末有标点、人名地名大写。','没有用中文拼音或写不出的单词，换成会写的简单词。']}]},
 {id:'vocabulary',title:'词汇与背单词',tagline:'少量多次、放进句子里记、按间隔复习',blocks:[
  {type:'steps',title:'每天 15–20 分钟',items:[
   {title:'先复习，再学新词',text:'先做到期的复习，再背新词；复习比新词更重要。'},
   {title:'放进句子里记',text:'每个新词看一个例句，最好自己说一个和生活有关的句子。'},
   {title:'按间隔复习',text:'学过的词在第 1、2、4、7、15 天再见一次，比一次背很久更牢。'},
   {title:'打卡留记录',text:'用手机 App 背完后，在首页上传完成页截图，连续天数一目了然。'}]},
  {type:'table',title:'常用词缀',headers:['词缀','意思','例子'],rows:[
   ['un- / dis- / im-','不、相反','unhappy · dislike · impossible'],
   ['re-','再、重新','rewrite · rebuild'],
   ['-er / -or / -ist','做…的人','teacher · visitor · artist'],
   ['-tion / -ment / -ness','名词','invention · development · kindness'],
   ['-ful / -less','有… / 没有…','helpful · careless'],
   ['-ly','副词','quickly · carefully'],
   ['-able','能…的','comfortable · enjoyable']]},
  {type:'list',title:'记不住怎么办',items:['把常错的词收进单词本，打开“遮住释义”自测。','拼写按音节拆开：in-ter-est-ing、ex-per-i-ence。','同一个词的不同意思分开记，并各配一个例句。','睡前花 3 分钟回看今天的新词。']}]}
];
export const tipSection=(id:TipSectionId)=>tipSections.find(s=>s.id===id)!;
