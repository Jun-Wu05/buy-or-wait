const state = { desire: 8, similarOwned: 2, useFrequency: 3, daysThinking: 3 };
let step = 1;
const total = 6;
const $ = (s) => document.querySelector(s);

function renderScale() {
  const box = $('#desireScale');
  for (let i = 1; i <= 10; i++) {
    const btn = document.createElement('button');
    btn.type = 'button'; btn.textContent = i;
    if (i === state.desire) btn.classList.add('selected');
    btn.onclick = () => { state.desire = i; [...box.children].forEach(b=>b.classList.remove('selected')); btn.classList.add('selected'); };
    box.appendChild(btn);
  }
}
renderScale();

document.querySelectorAll('[data-bind]').forEach(group => {
  const key = group.dataset.bind;
  group.querySelectorAll('button').forEach(btn => {
    if (Number(btn.dataset.value) === state[key]) btn.classList.add('selected');
    btn.onclick = () => {
      state[key] = Number(btn.dataset.value);
      group.querySelectorAll('button').forEach(b=>b.classList.remove('selected'));
      btn.classList.add('selected');
    };
  });
});

$('#necessity').oninput = e => $('#necessityValue').textContent = e.target.value;

function updateStep() {
  document.querySelectorAll('.question').forEach(q=>q.classList.toggle('active', Number(q.dataset.step)===step));
  $('#stepLabel').textContent = `${step} / ${total}`;
  $('#progressBar').style.width = `${(step/total)*100}%`;
  $('#backBtn').disabled = step === 1;
  $('#nextBtn').textContent = step === total ? '帮我决定' : '继续';
}

$('#backBtn').onclick = () => { if (step > 1) { step--; updateStep(); } };
$('#nextBtn').onclick = async () => {
  if (step < total) { step++; return updateStep(); }
  const payload = {
    price: Number($('#price').value || 0),
    monthlyBudget: Number($('#monthlyBudget').value || 1),
    desire: state.desire,
    similarOwned: state.similarOwned,
    useFrequency: state.useFrequency,
    daysThinking: state.daysThinking,
    necessity: Number($('#necessity').value),
  };
  $('#nextBtn').disabled = true; $('#nextBtn').textContent = '正在替你冷静一下…';
  try {
    const res = await fetch('/api/decide', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify(payload) });
    if (!res.ok) throw new Error('决策失败');
    showResult(await res.json());
  } catch (e) {
    alert(e.message);
  } finally {
    $('#nextBtn').disabled = false; $('#nextBtn').textContent = '帮我决定';
  }
};

function showResult(data) {
  $('#questionView').classList.add('hidden');
  const result = $('#resultView'); result.classList.remove('hidden','buy','wait','skip'); result.classList.add(data.decision.toLowerCase());
  $('#decisionStamp').textContent = data.decision;
  $('#resultTitle').textContent = data.copy.title;
  $('#resultSubtitle').textContent = data.copy.subtitle;
  $('#cooldownText').textContent = data.copy.cooldown;
  $('#confidenceValue').textContent = `${data.copy.pct}%`;
  $('#resultMode').textContent = data.mode === 'jev' ? `JEV · ${data.model || 'SYSTEM ONE'}` : 'DEMO DECISION · JEV READY';
  const probs = data.probabilities || {};
  for (const key of ['Buy','Wait','Skip']) {
    const value = Math.round((probs[key.toUpperCase()] || 0) * 100);
    $(`#p${key}`).textContent = `${value}%`; $(`#bar${key}`).style.width = `${value}%`;
  }
  const ring = $('.confidence-ring'); ring.style.background = `conic-gradient(var(--red) 0 ${data.copy.pct}%, var(--soft) ${data.copy.pct}% 100%)`;
}

$('#againBtn').onclick = () => { $('#resultView').classList.add('hidden'); $('#questionView').classList.remove('hidden'); step = 1; updateStep(); };
updateStep();

if (new URLSearchParams(location.search).get('preview') === 'result') {
  setTimeout(() => showResult({
    decision: 'WAIT',
    probabilities: { BUY: 0.28, WAIT: 0.51, SKIP: 0.21 },
    confidence: 0.51,
    mode: 'demo',
    copy: { title: '等等再买。', subtitle: '不是不能买，是现在还不够确定。', cooldown: '3 天后还想要，再回来问一次', pct: 51 }
  }), 80);
}
