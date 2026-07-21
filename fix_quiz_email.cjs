const fs = require('fs');
let content = fs.readFileSync('src/pages/PublicQuizChallenge.tsx', 'utf-8');

content = content.replace(
  "await saveResult(currentSession.user.id, scorePercentage);",
  "await saveResult(currentSession.user.id, scorePercentage, currentSession.user.email);"
);

content = content.replace(
  "await saveResult(authRes.data.session.user.id, scorePercentage);",
  "await saveResult(authRes.data.session.user.id, scorePercentage, authRes.data.session.user.email);"
);

content = content.replace(
  "const saveResult = async (userId: string, score: number) => {",
  "const saveResult = async (userId: string, score: number, userEmail?: string) => {"
);

content = content.replace(
  "description: `Email: ${email} | Score : ${Math.round(score)}% - Code Promo : ${score >= 80 ? \"EXPERT50\" : \"BOOST20\"}`,",
  "description: `Email: ${userEmail || email || 'Non renseigné'} | Score : ${Math.round(score)}% - Code Promo : ${score >= 80 ? \"EXPERT50\" : \"BOOST20\"}`,"
);

fs.writeFileSync('src/pages/PublicQuizChallenge.tsx', content);
