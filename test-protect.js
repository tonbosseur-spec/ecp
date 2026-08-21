function normalizeHtmlToMarkdown(htmlContent) {
  if (!htmlContent) return '';
  
  const hasHtml = /<div\s*.*?>|<br\s*\/?>/i.test(htmlContent);
  if (!hasHtml) return htmlContent;

  // Protect markdown code blocks so we don't strip tags inside them
  const codeBlocks = [];
  let protectedContent = htmlContent.replace(/```[\s\S]*?```|`[^`]+`/g, (match) => {
    codeBlocks.push(match);
    return `___CODE_BLOCK_${codeBlocks.length - 1}___`;
  });

  let md = protectedContent
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
    
  // Restore code blocks
  codeBlocks.forEach((block, i) => {
    md = md.replace(`___CODE_BLOCK_${i}___`, block);
  });
    
  return md;
}

const html1 = `<div># Titre</div><div>\`<div>est un tag html</div>\`</div>`;
console.log(normalizeHtmlToMarkdown(html1));
