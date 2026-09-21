const state = {
  desire: 3,
  similarOwned: 2,
  useFrequency: 2,
  pricePain: 3,
  daysThinking: 4,
  necessity: 3,
};

const reactions = {
  desire: {1:'你还很清醒，目前完全没被拿捏。',2:'有点心动，但钱包暂时安全。',3:'危险，开始反复点开它了。',4:'你离付款页只差一个理由。',5:'这已经不是种草，是占领大脑。'},
  similarOwned: {0:'很好，这至少不是重复建设。',1:'有替代品，但还不算严重。',2:'嗯……你已经有一个能干类似事情的了。',3:'继续买的话，可能只是收集欲在说话。',4:'再买一个，家里真的可以开始营业了。'},
  useFrequency: {0:'如果它只能活在你的想象里，先别付钱。',1:'偶尔用一下，性价比要重新想想。',2:'至少不是纯摆设，有真实使用场景。',4:'高频使用，是一个很强的购买理由。',5:'如果真没它不行，那它已经接近刚需了。'},
  pricePain: {1:'钱包甚至没有察觉到危险。',2:'负担不大，但便宜也不是购买理由。',3:'喜欢是真的，肉疼也是真的。',4:'已经到了值得睡一觉再决定的程度。',5:'如果买完要吃土，这个信号非常响亮。'},
  daysThinking: {0:'刚刷到就想买，是冲动消费的经典开场。',1:'热度还很新，再放一放看看。',4:'几天后还惦记，说明不是一闪而过。',7:'能惦记一周，已经有一点认真了。',21:'这么久还没忘，确实不像临时起意。'},
  necessity: {1:'想要没错，只是别把想要偷偷改名叫需要。',2:'有点用，但还没到非买不可。',3:'有明确用途，购买理由开始站得住脚。',4:'这已经比较接近真实需求了。',5:'如果真没它不行，那重点只剩预算是否允许。'},
};

const stampCopy = { BUY: '可以买', WAIT: '先等等', SKIP: '算了吧' };
const resultCopy = {
  BUY: {
    title: '行，这次真不是乱买。',
    subtitle: '你确实会用，而且钱包也没那么痛。别因为“终于被允许”就顺手再加购。',
    action: '行，我去下单',
  },
  WAIT: {
    title: '你不是缺这个，\n你只是很想现在拥有它。',
    subtitle: '很想要是真的，但“现在就要买”这件事，还没那么站得住脚。',
    action: '我不服，再测一次',
  },
  SKIP: {
    title: '你不是缺这个，\n你只是缺一个下单理由。',
    subtitle: '家里、使用频率和钱包已经一起投了反对票。先把付款页关掉。',
    action: '好，我先忍住',
  },
};

let step = 1;
const total = 6;
const $ = (s) => document.querySelector(s);

function syncReaction(key, value, animate = false) {
  const el = document.querySelector(`[data-reaction="${key}"]`);
  if (!el || reactions[key]?.[value] == null) return;
  el.textContent = reactions[key][value];
  if (animate) {
    el.classList.remove('reaction-pop');
    void el.offsetWidth;
    el.classList.add('reaction-pop');
  }
}

document.querySelectorAll('[data-bind]').forEach(group => {
  const key = group.dataset.bind;
  group.querySelectorAll('button').forEach(btn => {
    const value = Number(btn.dataset.value);
    if (value === state[key]) btn.classList.add('selected');
    btn.onclick = () => {
      state[key] = value;
      group.querySelectorAll('button').forEach(b => b.classList.remove('selected', 'picked'));
      btn.classList.add('selected', 'picked');
      setTimeout(() => btn.classList.remove('picked'), 280);
      syncReaction(key, value, true);
    };
  });
  syncReaction(key, state[key]);
});

function updateStep(direction = 'forward') {
  document.querySelectorAll('.question').forEach(q => {
    const active = Number(q.dataset.step) === step;
    q.classList.remove('enter-forward', 'enter-back');
    q.classList.toggle('active', active);
    if (active) {
      q.scrollTop = 0;
      void q.offsetWidth;
      q.classList.add(direction === 'back' ? 'enter-back' : 'enter-forward');
    }
  });
  $('#stepLabel').textContent = `${step} / ${total}`;
  $('#progressBar').style.width = `${(step / total) * 100}%`;
  $('#backBtn').disabled = step === 1;
  $('#nextBtn').textContent = step === total ? '帮我决定' : '继续';
}

$('#backBtn').onclick = () => {
  if (step > 1) {
    step--;
    updateStep('back');
  }
};

$('#nextBtn').onclick = async () => {
  if (step < total) {
    step++;
    return updateStep('forward');
  }
  $('#nextBtn').disabled = true;
  $('#nextBtn').textContent = '正在替你冷静一下…';
  try {
    const res = await fetch('/api/decide', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify(state) });
    if (!res.ok) throw new Error('决策失败');
    showResult(await res.json());
  } catch (e) {
    alert(e.message);
  } finally {
    $('#nextBtn').disabled = false;
    $('#nextBtn').textContent = '帮我决定';
  }
};

function showResult(data) {
  $('#questionView').classList.add('hidden');
  const result = $('#resultView');
  result.classList.remove('hidden','buy','wait','skip');
  result.classList.add(data.decision.toLowerCase());

  const copy = resultCopy[data.decision] || {};
  $('#decisionStamp').textContent = stampCopy[data.decision] || data.decision;
  $('#resultTitle').textContent = copy.title || data.copy.title;
  $('#resultSubtitle').textContent = copy.subtitle || data.copy.subtitle;
  $('#cooldownText').textContent = data.copy.cooldown;
  $('#confidenceValue').textContent = `${data.copy.pct}%`;
  $('#resultMode').textContent = data.mode === 'jev' ? '由 Jev 给出的参考' : '试玩版参考';
  $('#againBtn').textContent = copy.action || '我不服，再测一次';

  const probs = data.probabilities || {};
  for (const key of ['Buy','Wait','Skip']) {
    const value = Math.round((probs[key.toUpperCase()] || 0) * 100);
    $(`#p${key}`).textContent = `${value}%`;
    $(`#bar${key}`).style.width = `${value}%`;
  }
  result.scrollTop = 0;
}

$('#againBtn').onclick = () => {
  $('#resultView').classList.add('hidden');
  $('#questionView').classList.remove('hidden');
  step = 1;
  updateStep('forward');
};

updateStep('forward');

if (new URLSearchParams(location.search).get('preview') === 'result') {
  setTimeout(() => showResult({
    decision:'WAIT',
    probabilities:{BUY:0.18,WAIT:0.73,SKIP:0.09},
    confidence:0.73,
    mode:'demo',
    copy:{title:'等等再买。',subtitle:'不是不能买，是现在还不够确定。',cooldown:'先忍 3 天。3 天后还想要，再回来。',pct:73},
  }),80);
}
