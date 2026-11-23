import type {CloseReading} from './close-reading';

// 示例：2024 年北京中考英语阅读 D 篇（原文去掉了试卷中的中文注释），逐段讲解由教学示例编写，使用前请老师核对。
export const sampleCloseReading:{title:string;subtitle:string;source:string;level:string;minutes:number;closeReading:CloseReading}={
 title:'When Actions Disagree with Values',subtitle:'行动与内心价值观不一致时',source:'2024 年北京中考英语 · 阅读理解 D 篇',level:'中考阅读 D 篇',minutes:40,
 closeReading:{paragraphs:[
  {text:"Almost everyone has experienced the feeling of discomfort when their actions do not agree with their inner values. A man, for example, values work-life balance yet works 80 hours every week, caring little about his own health and family. Another example is a boy who holds his parents' love dear but gets angry at them in a moment of stress; or a woman who hopes to live healthily but gives in to the attraction of fast food during moments of weakness.",
   words:[
    {word:'discomfort',phonetic:'/dɪsˈkʌmfət/',meaning:'n. 不安；不舒服',usage:'dis-（否定）+ comfort；feel discomfort 感到不安'},
    {word:'inner values',phonetic:'/ˈɪnə ˈvæljuːz/',meaning:'内心的价值观',usage:'value 作动词意为“重视”：She values her friends.'},
    {word:'caring little about',phonetic:'',meaning:'几乎不在乎……',usage:'care little about sth. 不太在乎某事'},
    {word:'hold',phonetic:'/həʊld/',meaning:'hold sth. dear 珍视某物',usage:'本句：holds his parents\' love dear 珍视父母的爱'},
    {word:'gives in to',phonetic:'',meaning:'屈服于；抵挡不住',usage:'give in to the attraction of fast food 抵挡不住快餐的诱惑'},
    {word:'attraction',phonetic:'/əˈtrækʃn/',meaning:'n. 吸引力；诱惑',usage:'the attraction of sth. ……的吸引力'},
   ],
   sentences:[
    {text:'A man, for example, values work-life balance yet works 80 hours every week, caring little about his own health and family.',grammar:'主干：A man values … yet works …，yet 连接两个谓语，表示转折“却”。\nfor example 是插入语。\ncaring little about … 是现在分词短语作伴随状语，补充说明他当时的状态。',translation:'例如，一个男人重视工作与生活的平衡，却每周工作 80 个小时，几乎不关心自己的健康和家庭。'},
   ],
   practice:[
    {type:'word',target:'value (v.)',prompt:'用 value（重视）写一句话，说说你最看重什么、为什么。',example:'I value my time with my grandparents because they always listen to me.'},
    {type:'sentence',target:'…, doing sth.（分词作伴随状语）',prompt:'仿照 “…, caring little about …” 写一句话，用 -ing 短语补充说明人物当时的状态。',example:'My brother played games all night, forgetting all about his homework.'},
   ]},
  {text:"This disagreement can lead to serious results, such as worsening relationships, limited personal growth, and self-doubt. The emotional effects of feeling out of control and unable to live up to our own standards can also be deeply harmful. The shame and upset that go along with these feelings often force us into silence, resulting in more self-doubt. One reason for this silence might be that admitting to these behaviors can feel like showing a weakness or mistake that society tells us should be kept hidden. What's more, recognizing this disagreement requires coming face to face with uncomfortable truths about ourselves—a process that is as discouraging as it is necessary for growth.",
   words:[
    {word:'worsening',phonetic:'/ˈwɜːsənɪŋ/',meaning:'adj. 越来越坏的',usage:'worse + -en → worsen v. 恶化'},
    {word:'self-doubt',phonetic:'/ˌself ˈdaʊt/',meaning:'n. 自我怀疑',usage:'同类构词：self-confidence 自信、self-discovery 自我发现'},
    {word:'live up to',phonetic:'',meaning:'达到（标准、期望）',usage:'live up to our own standards / live up to sb.\'s expectations'},
    {word:'harmful',phonetic:'/ˈhɑːmfl/',meaning:'adj. 有害的',usage:'be harmful to … 对……有害'},
    {word:'admit',phonetic:'/ədˈmɪt/',meaning:'v. 承认',usage:'admit (to) doing sth. 承认做了某事'},
    {word:'face to face with',phonetic:'',meaning:'come face to face with 直面……',usage:'come face to face with the truth 直面真相'},
    {word:'discouraging',phonetic:'/dɪsˈkʌrɪdʒɪŋ/',meaning:'adj. 令人沮丧的',usage:'discourage v. 使泄气；反义 encouraging'},
   ],
   sentences:[
    {text:'One reason for this silence might be that admitting to these behaviors can feel like showing a weakness or mistake that society tells us should be kept hidden.',grammar:'主干：One reason … might be that …，that 引导表语从句。\n表语从句中：admitting to these behaviors 是动名词短语作主语；can feel like 后接动名词 showing …。\nthat society tells us should be kept hidden 是定语从句，修饰 a weakness or mistake；society tells us 是插入成分，should be kept hidden 是被动语态。',translation:'这种沉默的一个原因可能是：承认这些行为，会让人觉得是在暴露一种社会告诉我们应该隐藏起来的弱点或错误。'},
    {text:"What's more, recognizing this disagreement requires coming face to face with uncomfortable truths about ourselves—a process that is as discouraging as it is necessary for growth.",grammar:'主干：recognizing this disagreement（动名词作主语）requires coming face to face with …（require doing）。\n破折号后的 a process 是同位语，解释前面这件事；that 引导定语从句。\nas discouraging as it is necessary：“既令人沮丧，又是必需的”，表示两种性质同时存在。',translation:'此外，认识到这种不一致，需要直面关于自己的那些令人不舒服的真相——这个过程既令人沮丧，又是成长所必需的。'},
   ],
   practice:[
    {type:'word',target:'live up to',prompt:'用 live up to 写一句话，说说你想达到谁的期望或什么标准。',example:"I practise the piano every day because I want to live up to my teacher's expectations."},
    {type:'sentence',target:'Doing sth. can …（动名词作主语）',prompt:'用动名词短语作主语写一句话，说说做某件事会带来什么。',example:'Talking with friends can make a bad day feel much better.'},
   ]},
  {text:"Recognizing and addressing these behaviors can provide a possibility of change. By looking into the causes of our behaviors, we can begin to understand our actions more easily and work toward sticking to our beliefs. Research supports the idea that recognizing this disagreement, together with mindfulness and open communication, can help with this process. These methods help us slow down, reflect, and choose behaviors that follow our values more closely, even in the face of old habits or immediate needs.",
   words:[
    {word:'address',phonetic:'/əˈdres/',meaning:'v. 处理；应对',usage:'address a problem 解决问题'},
    {word:'sticking to',phonetic:'',meaning:'stick to 坚持',usage:'stick to our beliefs 坚持自己的信念'},
    {word:'mindfulness',phonetic:'/ˈmaɪndflnəs/',meaning:'n. 正念；专注当下',usage:'mind + -ful + -ness'},
    {word:'reflect',phonetic:'/rɪˈflekt/',meaning:'v. 反思',usage:'reflect on sth. 反思某事'},
    {word:'in the face of',phonetic:'',meaning:'面对……',usage:'in the face of difficulties 面对困难'},
    {word:'immediate',phonetic:'/ɪˈmiːdiət/',meaning:'adj. 眼前的；立即的',usage:'immediate needs 眼前的需要'},
   ],
   sentences:[
    {text:'By looking into the causes of our behaviors, we can begin to understand our actions more easily and work toward sticking to our beliefs.',grammar:'By doing … 表示方式“通过……”。\n主干：we can begin to understand … and work toward …，两个并列谓语。\nwork toward doing 朝……努力（toward 是介词，后接动名词）。',translation:'通过探究自己行为的原因，我们能更容易地理解自己的行为，并努力坚持自己的信念。'},
    {text:'Research supports the idea that recognizing this disagreement, together with mindfulness and open communication, can help with this process.',grammar:'主干：Research supports the idea。\nthat 引导同位语从句，说明 idea 的具体内容。\n从句中：recognizing this disagreement 是动名词主语，together with … 是插入成分，谓语是 can help with。',translation:'研究支持这样一种观点：认识到这种不一致，再加上正念和开放的沟通，可以帮助这一过程。'},
   ],
   practice:[
    {type:'sentence',target:'By doing sth., sb. can …',prompt:'用 By doing … 写一句话，说说你通过什么方法让自己在某方面进步了。',example:'By reading an English story every night, I can now understand many more new words.'},
    {type:'word',target:'reflect on',prompt:'用 reflect on 写一句话，说说你会在什么时候反思自己。',example:'Before I go to bed, I often reflect on what I have learned that day.'},
   ]},
  {text:"The key to dealing with this disagreement lies in compassion for ourselves and others. By developing a culture of openness and by understanding the challenges of aligning behaviors with beliefs, we can begin to break down what prevents us from having conversation and change. Admitting that this disagreement is a shared part of the human experience can enable us to speak openly, find support, and take necessary steps toward the agreement between our inner world and our actions.",
   words:[
    {word:'compassion',phonetic:'/kəmˈpæʃn/',meaning:'n. 同情；体谅',usage:'show compassion for others 体谅他人'},
    {word:'openness',phonetic:'/ˈəʊpənnəs/',meaning:'n. 开放；坦诚',usage:'open + -ness'},
    {word:'align',phonetic:'/əˈlaɪn/',meaning:'v. 使一致',usage:'align A with B 使 A 与 B 一致（第 31 题考查此词）'},
    {word:'break down',phonetic:'',meaning:'打破；消除',usage:'break down barriers 打破隔阂'},
    {word:'enable',phonetic:'/ɪˈneɪbl/',meaning:'v. 使能够',usage:'enable sb. to do sth.'},
   ],
   sentences:[
    {text:'The key to dealing with this disagreement lies in compassion for ourselves and others.',grammar:'主干：The key … lies in compassion。\nthe key to doing sth. 中 to 是介词，后接动名词 dealing。\nlie in 意为“在于”。',translation:'处理这种不一致的关键在于对自己和他人的体谅。'},
    {text:'Admitting that this disagreement is a shared part of the human experience can enable us to speak openly, find support, and take necessary steps toward the agreement between our inner world and our actions.',grammar:'主语：Admitting that …（动名词短语，内含 that 引导的宾语从句）。\n谓语：can enable；enable us to 后接三个并列的动词：speak / find / take。',translation:'承认这种不一致是人类共同经历的一部分，能让我们坦诚地交流、找到支持，并采取必要的行动，使内心世界与行动达成一致。'},
   ],
   practice:[
    {type:'sentence',target:'The key to doing sth. lies in …',prompt:'用 The key to … lies in … 写一句话，说说学好某件事的关键。',example:'The key to learning English well lies in using it every day.'},
    {type:'word',target:'enable sb. to do sth.',prompt:'用 enable sb. to do sth. 写一句话。',example:'The new library enables students to read after school.'},
   ]},
  {text:"While the disagreement between our inner values and actions may be common, through reflection, understanding and purposeful practice, we can bridge the divide and set out on a journey of self-discovery.",
   words:[
    {word:'purposeful',phonetic:'/ˈpɜːpəsfl/',meaning:'adj. 有目的的',usage:'purpose + -ful'},
    {word:'bridge the divide',phonetic:'',meaning:'弥合分歧（bridge 作动词）',usage:'bridge the gap 缩小差距'},
    {word:'set out on',phonetic:'',meaning:'开始（旅程、任务）',usage:'set out on a journey 踏上旅程'},
    {word:'self-discovery',phonetic:'/ˌself dɪˈskʌvəri/',meaning:'n. 自我发现',usage:'a journey of self-discovery 自我发现之旅'},
   ],
   sentences:[
    {text:'While the disagreement between our inner values and actions may be common, through reflection, understanding and purposeful practice, we can bridge the divide and set out on a journey of self-discovery.',grammar:'While 引导让步状语从句，意为“虽然……”。\nthrough … 介词短语作方式状语。\n主干：we can bridge the divide and set out on a journey，两个并列谓语。',translation:'虽然内心价值观与行动之间的不一致可能很常见，但通过反思、理解和有目的的练习，我们能够弥合这道裂痕，踏上自我发现之旅。'},
   ],
   practice:[
    {type:'sentence',target:'While …, …（让步状语从句）',prompt:'用 While 写一句“虽然……，但……”的句子。注意英语中 while / although 不和 but 连用。',example:'While the exam was difficult, I tried my best and finished every question.'},
   ]},
 ]},
};
