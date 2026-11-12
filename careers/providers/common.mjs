export async function inspectLinkedBoard(dom, response, company) {
  const result = await dom.evaluate(({ html, baseUrl, boardUrl, tokens }) => {
    const document = new DOMParser().parseFromString(html, 'text/html');
    document.querySelectorAll('script,style,noscript').forEach((node) => node.remove());
    const canonical = (value) => {
      const url = new URL(value, baseUrl);
      url.hash = '';
      url.pathname = url.pathname.replace(/\/$/, '') || '/';
      return url.href;
    };
    const links = [...document.querySelectorAll('a[href]')].flatMap((anchor) => {
      try {
        if (canonical(anchor.getAttribute('href')) !== canonical(boardUrl)) return [];
        return [{ text: anchor.textContent.trim(), href_raw: anchor.getAttribute('href'),
          resolved_url: new URL(anchor.getAttribute('href'), baseUrl).href }];
      } catch { return []; }
    });
    return { page_title: document.title, identity_present: tokens.some((token) => (document.title + document.body.textContent).includes(token)), links };
  }, { html: response.text, baseUrl: response.url, boardUrl: company.board_url, tokens: company.identity_tokens ?? [company.company_name] });
  if (!result.identity_present || !result.links.length) throw new Error('OWNERSHIP_CHAIN_MISSING');
  return { status: 'verified_official_link', verified_at: response.finished_at, company_id: company.company_id,
    legal_name: company.legal_name ?? null, from_url: response.url, to_url: company.board_url,
    body_path: response.body_path, metadata_path: response.metadata_path, sha256: response.sha256, ...result };
}

export async function htmlText(dom, value) {
  if (typeof value !== 'string') return '';
  return dom.evaluate((html) => {
    const document = new DOMParser().parseFromString(html, 'text/html');
    document.querySelectorAll('script,style,noscript').forEach((node) => node.remove());
    document.querySelectorAll('br').forEach((node) => node.replaceWith('\n'));
    document.querySelectorAll('p,div,li,h1,h2,h3,h4,h5,h6,tr,section').forEach((node) => node.append('\n'));
    return document.body.textContent.replace(/\r\n?/g, '\n').replace(/\n[ \t]+/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  }, value);
}
