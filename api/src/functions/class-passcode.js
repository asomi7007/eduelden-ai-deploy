const { app } = require('@azure/functions');
const { handleCors, jsonResponse } = require('../lib/auth');
const { validNewPasscode, saveClassPasscode } = require('../lib/classPasscode');

app.http('class-passcode', {
  methods: ['POST', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'manage/passcode',
  handler: async (request, context) => {
    const cors = handleCors(request);
    if (cors) return cors;

    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: '올바른 JSON 요청을 보내주세요.' }, 400);
    }
    if (!body || !process.env.ADMIN_PASSWORD || body.adminPw !== process.env.ADMIN_PASSWORD) {
      return jsonResponse({ error: '관리자 비밀번호가 틀렸습니다.' }, 403);
    }
    if (!validNewPasscode(body.passcode)) {
      return jsonResponse({ error: '패스코드는 공백 없이 4~128자로 입력해주세요.' }, 400);
    }
    if (body.passcode !== body.confirmPasscode) {
      return jsonResponse({ error: '새 패스코드와 확인 값이 일치하지 않습니다.' }, 400);
    }

    try {
      const result = await saveClassPasscode(body.passcode);
      context.log('Class passcode updated.');
      return jsonResponse({ message: '수업 패스코드를 변경했습니다. 새 신청과 학생 취소에 바로 적용됩니다.', ...result });
    } catch (error) {
      context.error('Class passcode update failed:', error.message);
      return jsonResponse({ error: error.message }, 502);
    }
  },
});
