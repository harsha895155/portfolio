async function check() {
  const res = await fetch('http://localhost:5000/');
  const html = await res.text();
  console.log('Home Page Check:', {
    status: res.status,
    hasResumeTrigger: html.includes('resume-trigger'),
    hasTopOpen: html.includes('modal-top-open'),
    hasTopDownload: html.includes('modal-top-download'),
    hasModalIframe: html.includes('id="modal-iframe"')
  });

  const resPdf = await fetch('http://localhost:5000/Thimmareddygari_Harshavardhan_Reddy_Resume.pdf');
  console.log('PDF Check:', {
    status: resPdf.status,
    contentType: resPdf.headers.get('content-type'),
    contentLength: resPdf.headers.get('content-length')
  });
}
check();
