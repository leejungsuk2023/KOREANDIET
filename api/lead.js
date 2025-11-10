// /api/lead.js — 수정된 최종 버전

const crypto = require('crypto');

const PIXEL_ID = '1816534509233210';
const ACCESS_TOKEN = process.env.META_ACCESS_TOKEN;
const TEST_EVENT_CODE = process.env.META_TEST_EVENT_CODE;

// 해싱 함수들 (이름, 이메일, 전화번호)
function sha256Lower(s) {
  return crypto.createHash('sha256').update((s || '').trim().toLowerCase()).digest('hex');
}
function sha256Phone(s) {
  return crypto.createHash('sha256').update((s || '').replace(/[^\d]/g,'')).digest('hex');
}
// 이름 해싱 (이메일과 동일하게 소문자 변환 후 해싱)
function sha256Name(s) {
  return sha256Lower(s);
}

// Node 기본 req에서 JSON 바디 파서
async function readJson(req) {
  return await new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); }
      catch (e) { resolve({}); }
    });
  });
}

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') {
      return res.status(405).json({ ok: false, hint: 'POST /api/lead with JSON body' });
    }
    if (!ACCESS_TOKEN) {
      console.error('🚨 META_ACCESS_TOKEN is missing');
      return res.status(500).json({ ok:false, error: 'META_ACCESS_TOKEN is missing' });
    }

    // [개선됨] 이메일, 전화번호(국가코드 포함), 성/이름 분리, value/currency 추가
    const {
      eventId, eventSourceUrl,
      email, phone, firstName, lastName, lineId,
      fbp, fbc, userAgent,
      value, currency
    } = await readJson(req);

    console.log('📥 받은 고객 정보:', { email, phone, firstName, lastName });

    // [개선됨] user_data에 이메일, 성/이름 분리, 국가코드 포함 전화번호
    const userData = {
      em: email ? [sha256Lower(email)] : undefined, // 이메일 해싱
      ph: phone ? [sha256Phone(phone)] : undefined, // 전화번호 해싱 (국가코드 포함)

      // 이름/성 분리 (매칭률 향상)
      fn: firstName ? [sha256Name(firstName)] : undefined, // 이름
      ln: lastName ? [sha256Name(lastName)] : undefined, // 성

      fbp: fbp || undefined,
      fbc: fbc || undefined,
      client_user_agent: userAgent || undefined,
    };

    console.log('🔐 해싱 전 매칭 파라미터:', {
      hasEmail: !!email,
      hasPhone: !!phone,
      hasFirstName: !!firstName,
      hasLastName: !!lastName,
      hasFbp: !!fbp,
      hasFbc: !!fbc
    });

    // 빈 값(undefined)은 전송 페이로드에서 아예 제거
    Object.keys(userData).forEach(key => {
      if (userData[key] === undefined) {
        delete userData[key];
      }
    });

    const payload = {
      data: [{
        event_name: 'Lead',
        event_time: Math.floor(Date.now()/1000),
        event_id: eventId || `srv-${Date.now()}`,
        action_source: 'website',
        event_source_url: eventSourceUrl || 'https://koreandiet.store/',
        user_data: userData, // 수정된 userData 객체 사용
        custom_data: {
          value: value || 149000, // 리드당 가치 (기본값 149000원)
          currency: currency || 'KRW' // 통화 코드 (기본값 KRW)
        },
        ...(TEST_EVENT_CODE ? { test_event_code: TEST_EVENT_CODE } : {})
      }]
    };

    const url = `https://graph.facebook.com/v19.0/${PIXEL_ID}/events?access_token=${ACCESS_TOKEN}`;
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify(payload)
    });
    const json = await r.json();

    return res.status(r.status).json({ ok: r.ok, meta: json });

  } catch (e) {
    console.error('🚨 CAPI 전송 중 심각한 에러:', e);
    return res.status(500).json({ ok: false, error: e.message });
  }
};
