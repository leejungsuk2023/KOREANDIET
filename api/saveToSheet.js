// Google Sheets API를 사용하여 설문 데이터를 저장하는 서버리스 함수

const { google } = require('googleapis');

module.exports = async (req, res) => {
  // CORS 헤더 설정
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // OPTIONS 요청 처리 (preflight)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('📊 구글 시트 저장 요청 받음');
    console.log('데이터:', req.body);

    // 환경 변수에서 Google Service Account 정보 가져오기
    const credentials = {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    };

    const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;

    if (!credentials.client_email || !credentials.private_key || !SPREADSHEET_ID) {
      console.error('❌ 환경 변수 누락');
      return res.status(500).json({
        error: 'Google Sheets 설정이 완료되지 않았습니다.',
        missing: {
          email: !credentials.client_email,
          key: !credentials.private_key,
          sheetId: !SPREADSHEET_ID
        }
      });
    }

    // Google Sheets API 인증
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // 요청 데이터 추출
    const {
      fullName,
      lineId,
      phoneNumber,
      currentWeight,
      height,
      past_med_exp,
      caffeine_sensitivity,
      has_condition,
      is_pregnant,
      sideEffects,
      diagnosisResult,
      bmi,
      consent,
      submittedAt
    } = req.body;

    // 한국어 변환 함수
    const translateValue = (field, value) => {
      const translations = {
        past_med_exp: {
          'has_experience': 'เคย',
          'no_experience': 'ไม่เคย'
        },
        caffeine_sensitivity: {
          'sensitive': 'ไว / มีอาการ',
          'not_sensitive': 'ไม่ไว / ไม่มีอาการ'
        },
        has_condition: {
          'has_condition': 'มี',
          'no_condition': 'ไม่มี'
        },
        is_pregnant: {
          'yes': 'ใช่',
          'no': 'ไม่ใช่'
        }
      };
      return translations[field]?.[value] || value;
    };

    // 시트에 추가할 행 데이터
    const rowData = [
      submittedAt || new Date().toISOString(),
      fullName || '',
      lineId || '',
      phoneNumber || '',
      currentWeight || '',
      height || '',
      bmi || '',
      translateValue('past_med_exp', past_med_exp),
      translateValue('caffeine_sensitivity', caffeine_sensitivity),
      translateValue('has_condition', has_condition),
      translateValue('is_pregnant', is_pregnant), // 임신여부 추가
      sideEffects || '',
      diagnosisResult || '',
      consent || 'no' // 동의 여부 기록 (법적 보험)
    ];

    console.log('📝 시트에 추가할 데이터:', rowData);

    // 시트에 데이터 추가
    const response = await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'Sheet1!A:N', // A부터 N까지 14개 컬럼 (임신여부 추가)
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [rowData],
      },
    });

    console.log('✅ 구글 시트 저장 성공:', response.data);

    return res.status(200).json({
      success: true,
      message: '데이터가 성공적으로 저장되었습니다.',
      updatedRange: response.data.updates.updatedRange
    });

  } catch (error) {
    console.error('🚨 구글 시트 저장 에러:', error);
    return res.status(500).json({
      error: '데이터 저장 중 오류가 발생했습니다.',
      details: error.message
    });
  }
};
