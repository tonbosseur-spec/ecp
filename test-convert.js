function normalizeHtmlToMarkdown(htmlContent) {
  if (!htmlContent) return '';
  if (!/<[a-z][\s\S]*>/i.test(htmlContent)) return htmlContent;

  let md = htmlContent
    .replace(/<b(?:\s+[^>]*)?>(.*?)<\/b>/gi, '**$1**')
    .replace(/<strong(?:\s+[^>]*)?>(.*?)<\/strong>/gi, '**$1**')
    .replace(/<i(?:\s+[^>]*)?>(.*?)<\/i>/gi, '*$1*')
    .replace(/<em(?:\s+[^>]*)?>(.*?)<\/em>/gi, '*$1*')
    .replace(/<div>\s*<br[^>]*>\s*<\/div>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<br[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
    
  return md;
}

const html1 = `<div># Bienvenue dans R 👋</div><div><br></div><div>R est un **langage de programmation** et un environnement <b>très</b> utilisé.</div>`;
console.log(JSON.stringify(normalizeHtmlToMarkdown(html1)));
