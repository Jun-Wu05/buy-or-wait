const state={product:'',desire:3,similarOwned:2,useFrequency:2,pricePain:3,daysThinking:4,necessity:3};
let step=1;
let moving=false;
const total=6;
const $=s=>document.querySelector(s);
const screens={home:$('#homeScreen'),confirm:$('#confirmScreen'),quiz:$('#quizScreen'),analysis:$('#analysisScreen'),result:$('#resultScreen')};

const resultCopy={
  BUY:{stamp:'可以买',subtitle:'你不是一时上头，使用场景和预算也都说得过去。',quote:'“这次我不拦你，但别顺手再加购。”'},
  WAIT:{stamp:'先等等',subtitle:'你喜欢它是真的，但现在更像冲动，不像需求。',quote:'“你不是需要它，你只是最近想它想得有点多。”'},
  SKIP:{stamp:'算了吧',subtitle:'喜欢归喜欢，但它现在更像一个漂亮的购买理由。',quote:'“你已经有替代品了，别再给自己找借口。”'}
};

function showScreen(name){
  Object.entries(screens).forEach(([key,el])=>el.classList.toggle('active',key===name));
  $('#topMeta').textContent=name==='home'?'付款前，先问自己':name==='result'?'这次先到这里':'慢一点买，也挺好';
}

function setProduct(name){
  state.product=(name||'').trim();
  $('#productInput').value=state.product;
  $('#confirmProduct').textContent=state.product||'这个东西';
  $('#quizProduct').textContent=state.product||'这个东西';
  $('#resultProduct').textContent=state.product||'这件东西';
}

function startFlow(){
  const value=$('#productInput').value.trim();
  if(!value){
    $('#productInput').focus();
    $('#productInput').classList.add('shake');
    setTimeout(()=>$('#productInput').classList.remove('shake'),260);
    return;
  }
  setProduct(value);
  showScreen('confirm');
}

$('#startBtn').onclick=startFlow;
$('#productInput').addEventListener('keydown',e=>{if(e.key==='Enter')startFlow();});
$('#clearInput').onclick=()=>{setProduct('');$('#productInput').focus();};
document.querySelectorAll('[data-example]').forEach(btn=>btn.onclick=()=>setProduct(btn.dataset.example));
$('#confirmBack').onclick=()=>showScreen('home');
$('#confirmBtn').onclick=()=>{step=1;updateStep();showScreen('quiz');};
$('#quizBack').onclick=()=>{
  if(moving)return;
  if(step===1) return showScreen('confirm');
  step--;
  updateStep();
};

function updateStep(){
  document.querySelectorAll('.question').forEach(q=>q.classList.toggle('active',Number(q.dataset.step)===step));
  $('#progressText').textContent=`${step}/${total}`;
  $('#progressBar').style.width=`${(step/total)*100}%`;
}

document.querySelectorAll('[data-bind]').forEach(group=>{
  const key=group.dataset.bind;
  group.querySelectorAll('button').forEach(btn=>{
    const value=Number(btn.dataset.value);
    btn.onclick=()=>{
      if(moving)return;
      state[key]=value;
      group.querySelectorAll('button').forEach(b=>b.classList.remove('selected'));
      btn.classList.add('selected');
      moving=true;
      setTimeout(()=>{
        if(step<total){
          step++;
          moving=false;
          updateStep();
        }else{
          moving=false;
          finishDecision();
        }
      },140);
    };
  });
});

async function finishDecision(){
  if(moving)return;
  moving=true;
  showScreen('analysis');
  const minDelay=new Promise(resolve=>setTimeout(resolve,900));
  try{
    const request=fetch('/api/decide',{
      method:'POST',
      headers:{'content-type':'application/json'},
      body:JSON.stringify(state)
    }).then(async res=>{
      if(!res.ok)throw new Error('决策失败');
      return res.json();
    });
    const [data]=await Promise.all([request,minDelay]);
    showResult(data);
  }catch(e){
    await minDelay;
    // 本地接口异常时仍给出可预览结果，避免把体验卡死。
    showResult({
      decision:'WAIT',
      probabilities:{BUY:.21,WAIT:.68,SKIP:.11},
      mode:'preview',
      copy:{pct:68,cooldown:'先放购物车 3 天。三天后还想买，再回来。'}
    });
  }finally{
    moving=false;
  }
}

function showResult(data){
  const decision=data.decision||'WAIT';
  const copy=resultCopy[decision]||resultCopy.WAIT;
  const probs=data.probabilities||{BUY:.21,WAIT:.68,SKIP:.11};
  const pct=data.copy?.pct??Math.round((probs[decision]||0)*100);

  $('#decisionStamp').textContent=copy.stamp;
  $('#confidenceValue').textContent=`${pct}%`;
  $('#resultSubtitle').textContent=copy.subtitle;
  $('#walletQuote').textContent=copy.quote;
  $('#cooldownText').textContent=data.copy?.cooldown||'先放购物车 3 天。三天后还想买，再回来。';
  $('#resultMode').textContent=data.mode==='jev'?'参考 Jev 的判断':'试玩版参考';

  for(const key of ['Buy','Wait','Skip']){
    const value=Math.round((probs[key.toUpperCase()]||0)*100);
    $(`#p${key}`).textContent=`${value}%`;
    $(`#bar${key}`).style.width=`${value}%`;
  }
  showScreen('result');
  $('#resultScreen').scrollTop=0;
}

$('#againBtn').onclick=()=>{
  step=1;
  moving=false;
  document.querySelectorAll('.choice-list button').forEach(b=>b.classList.remove('selected'));
  showScreen('home');
  $('#productInput').focus();
};

if(new URLSearchParams(location.search).get('preview')==='result'){
  setProduct('AirPods Max');
  showResult({decision:'WAIT',probabilities:{BUY:.21,WAIT:.68,SKIP:.11},mode:'preview',copy:{pct:68,cooldown:'先放购物车 3 天。三天后还想买，再回来。'}});
}else{
  showScreen('home');
}