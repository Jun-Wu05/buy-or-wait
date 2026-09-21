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
  const desire = Math.min(1, Math.max(0, (state.desire - 1) / 4));
  const duplicatePenalty = Math.min(1, state.similarOwned / 4);
  const frequency = Math.min(1, state.useFrequency / 5);
  const pricePain = Math.min(1, Math.max(0, (state.pricePain - 1) / 4));
  const urgency = Math.min(1, Math.max(0, (state.necessity - 1) / 4));
  const considered = Math.min(1, state.daysThinking / 21);

  let buy = 0.16 + desire * 0.24 + frequency * 0.19 + urgency * 0.22 + considered * 0.10;
  buy -= pricePain * 0.24 + duplicatePenalty * 0.18;

  let skip = 0.10 + pricePain * 0.22 + duplicatePenalty * 0.22 + (1 - desire) * 0.19;
  skip += (1 - frequency) * 0.11 + (1 - urgency) * 0.10;

  let wait = 0.30 + (1 - considered) * 0.20;
  wait += desire >= 0.5 && pricePain >= 0.5 ? 0.10 : 0;
  wait += urgency >= 0.5 && considered < 0.35 ? 0.05 : 0;

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
        'Given this shopper context, which action is most sensible right now? Decide from how strongly they want it, whether they already own substitutes, realistic usage, how painful the price feels, how long they have considered it, and whether it is truly needed.',
        {
          BUY: 'Buy now. The desire and real utility are strong, the item is not redundant, and the financial discomfort is acceptable.',
          WAIT: 'Do not buy today. The desire may be real, but more cooling-off time would improve the decision.',
          SKIP: 'Skip this purchase. It is redundant, weakly needed, unlikely to be used, or financially uncomfortable.'
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

  if (result.decision === 'BUY') {
    const reason = state.useFrequency >= 4 && state.necessity >= 4
      ? '不是纯上头，你是真的会用，而且确实需要。'
      : state.pricePain <= 2
        ? '喜欢、会用，钱包也扛得住，这次理由比较完整。'
        : '条件基本支持购买，但付款前还是看一眼自己的真实预算。';
    return { title: '可以买。', subtitle: reason, cooldown: '今天下单，也不太像冲动消费', pct };
  }

  if (result.decision === 'SKIP') {
    const reason = state.similarOwned >= 3
      ? '家里已经有不少替代品，这次更像重复拥有。'
      : state.pricePain >= 4
        ? '喜欢是真的，但这个价格已经让钱包明显不舒服了。'
        : state.useFrequency <= 1
          ? '你更喜欢“拥有它”的感觉，不一定真的会用它。'
          : '这次购买理由还不够强，把钱留给更确定的喜欢。';
    return { title: '这次先别买。', subtitle: reason, cooldown: '先放回收藏夹，别放进购物车', pct };
  }

  const days = state.pricePain >= 4 || state.daysThinking <= 1 ? 7 : 3;
  const subtitle = state.desire >= 4
    ? '你是真的很上头，但上头的时候最适合晚点付款。'
    : '不是不能买，是现在还不够确定。';
  return {
    title: '等等再买。',
    subtitle,
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
