export function initLanguage() {
 document.querySelector('.language-select')?.addEventListener('change', event => {
  if (['index.html','index-en.html'].includes(event.target.value)) location.href = event.target.value;
 });
}
