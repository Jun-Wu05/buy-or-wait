import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const publicDir = join(__dirname, 'public');
const port = Number(process.env.PORT || 3000);

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8',
};

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function demoDecision(state) {
  const pricePressure = Math.min(1, state.price / Math.max(1, state.monthlyBudget));
  const duplicatePenalty = Math.min(1, state.similarOwned / 4);
  const desire = state.desire / 10;
  const frequency = state.useFrequency / 5;
  const urgency = state.necessity / 10;
  const considered = Math.min(1, state.daysThinking / 14);

  let buy = 0.18 + desire * 0.24 + frequency * 0.19 + urgency * 0.21 + considered * 0.08;
  buy -= pricePressure * 0.24 + duplicatePenalty * 0.18;

  let skip = 0.12 + pricePressure * 0.20 + duplicatePenalty * 0.22 + (1 - desire) * 0.20;
  skip += (1 - frequency) * 0.10 + (1 - urgency) * 0.08;

  let wait = 0.32 + (1 - considered) * 0.18 + Math.abs(0.5 - desire) * 0.06;
  wait += pricePressure > 0.45 ? 0.08 : 0;

  buy = Math.max(0.03, buy);
  wait = Math.max(0.03, wait);
  skip = Math.max(0.03, skip);
  const total = buy + wait + skip;
  const probabilities = {
    BUY: buy / total,
    WAIT: wait / total,
    SKIP: skip / total,
  };
  const decision = Object.entries(probabilities).sort((a, b) => b[1] - a[1])[0][0];
  return { decision, probabilities, confidence: probabilities[decision], mode: 'demo' };
}

async function decideWithJev(state) {
  if (!process.env.TYPESAFE_API_KEY) return demoDecision(state);

  const { choice, TypeSafeClient } = await import('@typesafe-ai/sdk');
  const client = new TypeSafeClient({ apiKey: process.env.TYPESAFE_API_KEY });
  const response = await client.systemOne({
    state,
    questions: {
      decision: choice(
        'Given this shopper context, which action is most sensible right now? Choose based on affordability, real need, likely usage, duplicate ownership, impulse risk, and how long the user has already considered the purchase.',
        {
          BUY: 'Buy now. The item is affordable enough, meaningfully wanted or needed, and likely to be used enough to justify the purchase.',
          WAIT: 'Do not buy today. The user may still want it, but a cooling-off period or more information would improve the decision.',
          SKIP: 'Skip this purchase. It is low-value, redundant, weakly needed, unlikely to be used, or financially uncomfortable.'
        }
      )
    }
  });

  const answer = response.answers.decision;
  return {
    decision: answer.choice,
    probabilities: answer.probabilities,
    confidence: answer.confidence,
    model: response.model,
    usage: response.usage,
    mode: 'jev'
  };
}

function buildCopy(result, state) {
  const pct = Math.round(result.confidence * 100);
  const priceRatio = state.price / Math.max(1, state.monthlyBudget);
  if (result.decision === 'BUY') {
    const reason = state.useFrequency >= 3
      ? '你是真的会用，不只是想拥有。'
      : '目前条件支持购买，但别为了“便宜”制造需求。';
    return { title: '可以买。', subtitle: reason, cooldown: '今天下单也不算冲动', pct };
  }
  if (result.decision === 'SKIP') {
    const reason = state.similarOwned >= 2
      ? '你已经有相似替代品，这次更像重复拥有。'
      : priceRatio > 0.6
        ? '它正在明显挤压你的可用预算。'
        : '想要感不够强，使用场景也不够明确。';
    return { title: '这次先别买。', subtitle: reason, cooldown: '把钱留给更确定的喜欢', pct };
  }
  const days = state.price > state.monthlyBudget * 0.4 ? 7 : 3;
  return {
    title: '等等再买。',
    subtitle: '不是不能买，是现在还不够确定。',
    cooldown: `${days} 天后还想要，再回来问一次`,
    pct
  };
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'POST' && req.url === '/api/decide') {
      let body = '';
      for await (const chunk of req) body += chunk;
      const state = JSON.parse(body || '{}');
      const result = await decideWithJev(state);
      return json(res, 200, { ...result, copy: buildCopy(result, state) });
    }

    let pathname = req.url === '/' ? '/index.html' : req.url.split('?')[0];
    pathname = normalize(pathname).replace(/^([.][.][/\\])+/, '');
    const file = join(publicDir, pathname);
    if (!file.startsWith(publicDir)) return json(res, 403, { error: 'Forbidden' });
    const content = await readFile(file);
    res.writeHead(200, { 'content-type': mime[extname(file)] || 'application/octet-stream' });
    res.end(content);
  } catch (error) {
    if (error?.code === 'ENOENT') return json(res, 404, { error: 'Not found' });
    console.error(error);
    return json(res, 500, { error: error?.message || 'Decision failed' });
  }
});

server.listen(port, () => {
  console.log(`Buy or Wait running at http://localhost:${port}`);
  console.log(process.env.TYPESAFE_API_KEY ? 'Jev mode enabled' : 'Demo mode enabled (no TYPESAFE_API_KEY)');
});
