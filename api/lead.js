// /api/lead.js  (Vercel Serverless Function: Node.js)
const crypto = require('crypto');
const fetch = require('node-fetch');

const PIXEL_ID = '1816534509233210';
const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;        // 반드시 환경변수로 넣기
const TEST_EVENT_CODE = process.env.META_TEST_EVENT_CODE;  // 테스트 때만 설정

function sha256Lower(s) {
  return crypto.createHash('sha256').update((s || '').trim().toLowerCase()).digest('hex');
}
function sha256Phone(s) {
  return crypto.createHash('sha256').update((s || '').replace(/[^\d]/g,'')).digest('hex');
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok:false, error: 'Method Not Allowed' });
  }
  try {
    if (!ACCESS_TOKEN) {
      throw new Error('META_ACCESS_TOKEN is missing');
    }
    const { eventId, eventSourceUrl, email, phone, fbp, fbc, userAgent } = req.body || {};

    const data = [{
      event_name: 'Lead',
      event_time: Math.floor(Date.now() / 1000),
      event_id: eventId || `srv-${Date.now()}`,
      action_source: 'website',
      event_source_url: eventSourceUrl || 'https://koreandiet.store/',
      user_data: {
        em: email ? [sha256Lower(email)] : undefined,
        ph: phone ? [sha256Phone(phone)] : undefined,
        fbp: fbp || undefined,
        fbc: fbc || undefined,
        client_user_agent: userAgent || undefined
      },
      custom_data: { currency: 'KRW', value: 0 },
      ...(TEST_EVENT_CODE ? { test_event_code: TEST_EVENT_CODE } : {})
    }];

    const url = `https://graph.facebook.com/v19.0/${PIXEL_ID}/events?access_token=${ACCESS_TOKEN}`;
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ data })
    });
    const json = await r.json();
    // 실패 시 로깅
    if (!r.ok) {
      console.error('CAPI Error:', json);
      return res.status(500).json({ ok:false, meta: json });
    }
    return res.status(200).json({ ok:true, meta: json });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok:false, error: e.message });
  }
};