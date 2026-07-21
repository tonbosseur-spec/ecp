const fs = require('fs');
let content = fs.readFileSync('src/pages/AdminHub.tsx', 'utf-8');

const copyFunction = `
  const copyQuizLink = (courseId: string) => {
    const url = window.location.origin + '/challenge/' + courseId;
    navigator.clipboard.writeText(url);
    alert('Lien du challenge copié : ' + url);
  };
`;

content = content.replace(
  "const handleApprovePayment = async",
  copyFunction + "\n  const handleApprovePayment = async"
);

fs.writeFileSync('src/pages/AdminHub.tsx', content);
