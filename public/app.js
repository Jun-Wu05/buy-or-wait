const state={desire:3,similarOwned:2,useFrequency:2,pricePain:3,daysThinking:4,necessity:3};
const reactions={
  desire:{1:'还挺清醒。',2:'只是有点心动。',3:'开始反复点开它了。',4:'你离付款页只差一个借口。',5:'这已经不是种草，是占领大脑。'},
  similarOwned:{0:'这条先不扣分。',1:'嗯，有替代品。',2:'“但是不一样”是经典台词。',3:'你这不是缺，是想收集。',4:'懂了，家里已经有编制。'},
  useFrequency:{0:'它已经提前住进角落了。',1:'偶尔想起来，不太值。',2:'至少不是纯摆设。',4:'高频使用，这理由站得住。',5:'那它确实接近刚需。'},
  pricePain:{1:'钱包毫无波澜。',2:'负担不大。',3:'喜欢是真的，肉疼也是真的。',4:'建议先睡一觉。',5:'这个信号已经很响了。'},
  daysThinking:{0:'刚刷到就想买，危险。',1:'热度还很新。',4:'几天后还惦记，算认真。',7:'一周了，确实不是闪念。',21:'这么久没忘，有点东西。'},
  necessity:{1:'想要没错，别冒充需要。',2:'有点用，但没到非买不可。',3:'理由开始站得住了。',4:'这已经比较像真实需求。',5:'行，那重点只剩预算。'}
};
const progressCopy=['还没开始','我听着呢','有点不对劲了','嗯，我大概懂了','再问两句','差不多了','最后一个问题'];
const stampCopy={BUY:'可以买',WAIT:'先等等',SKIP:'算了吧'};
const resultCopy={
  BUY:{title:'行，这次真不是乱买。',subtitle:'你会用，预算也扛得住。可以买，但别顺手再加购。',action:'行，我知道了'},
  WAIT:{title:'你不是缺这个，\n你只是很想现在拥有它。',subtitle:'心动是真的，但“现在就买”还没那么站得住。',action:'我不服，再来'},
  SKIP:{title:'你不是缺这个，\n你只是缺一个下单理由。',subtitle:'替代品、使用频率和钱包已经一起投了反对票。',action:'好，我先关掉'}
};
let step=1;
const total=6;
const $=s=>document.querySelector(s);

function syncReaction(key,value){
  const el=document.querySelector(`[data-reaction="${key}"]`);
  if(el&&reactions[key]?.[value]!=null) el.textContent=reactions[key][value];
}

document.querySelectorAll('[data-bind]').forEach(group=>{
  const key=group.dataset.bind;
  group.querySelectorAll('button').forEach(btn=>{
    const value=Number(btn.dataset.value);
    if(value===state[key]) btn.classList.add('selected');
    btn.onclick=()=>{
      state[key]=value;
      group.querySelectorAll('button').forEach(b=>b.classList.remove('selected'));
      btn.classList.add('selected');
      syncReaction(key,value);
    };
  });
  syncReaction(key,state[key]);
});

function updateStep(){
  document.querySelectorAll('.question').forEach(q=>{
    const active=Number(q.dataset.step)===step;
    q.classList.toggle('active',active);
    if(active) q.scrollTop=0;
  });
  $('#stepLabel').textContent=progressCopy[step];
  $('#backBtn').disabled=step===1;
  $('#nextBtn').textContent=step===total?'给个结论':'下一句';
}

$('#startBtn').onclick=()=>{
  $('#startScreen').classList.add('hidden');
  $('#decisionForm').classList.remove('hidden');
  updateStep();
};

$('#backBtn').onclick=()=>{if(step>1){step--;updateStep();}};

$('#nextBtn').onclick=async()=>{
  if(step<total){step++;updateStep();return;}
  $('#nextBtn').disabled=true;
  $('#nextBtn').textContent='我想一下…';
  try{
    const res=await fetch('/api/decide',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(state)});
    if(!res.ok) throw new Error('决策失败');
    showResult(await res.json());
  }catch(e){alert(e.message);}finally{
    $('#nextBtn').disabled=false;
    $('#nextBtn').textContent='给个结论';
  }
};

function showResult(data){
  $('#questionView').classList.add('hidden');
  const result=$('#resultView');
  result.classList.remove('hidden','buy','wait','skip');
  result.classList.add(data.decision.toLowerCase());
  const copy=resultCopy[data.decision]||{};
  $('#decisionStamp').textContent=stampCopy[data.decision]||data.decision;
  $('#resultTitle').textContent=copy.title||data.copy.title;
  $('#resultSubtitle').textContent=copy.subtitle||data.copy.subtitle;
  $('#cooldownText').textContent=data.copy.cooldown;
  $('#confidenceValue').textContent=`${data.copy.pct}%`;
  $('#resultMode').textContent=data.mode==='jev'?'Jev 给的参考':'试玩版参考';
  $('#againBtn').textContent=copy.action||'我不服，再来';
  const probs=data.probabilities||{};
  for(const key of ['Buy','Wait','Skip']){
    const value=Math.round((probs[key.toUpperCase()]||0)*100);
    $(`#p${key}`).textContent=`${value}%`;
    $(`#bar${key}`).style.width=`${value}%`;
  }
  document.querySelectorAll('.probability-list>div').forEach(el=>el.classList.remove('recommended'));
  const map={BUY:0,WAIT:1,SKIP:2};
  const row=document.querySelectorAll('.probability-list>div')[map[data.decision]];
  if(row) row.classList.add('recommended');
  result.scrollTop=0;
}

$('#againBtn').onclick=()=>{
  $('#resultView').classList.add('hidden');
  $('#questionView').classList.remove('hidden');
  $('#startScreen').classList.remove('hidden');
  $('#decisionForm').classList.add('hidden');
  $('#stepLabel').textContent='把手机给我';
  step=1;
};

if(new URLSearchParams(location.search).get('preview')==='result'){
  $('#questionView').classList.add('hidden');
  setTimeout(()=>showResult({decision:'WAIT',probabilities:{BUY:.18,WAIT:.73,SKIP:.09},mode:'demo',copy:{cooldown:'先放三天。三天后还天天来看，再说。',pct:73}}),50);
}
