export function initLanguage() {
    const pages = ['index', 'projects', 'skills', 'contact'];
    const allowed = pages.flatMap(page => [page + '.html', page + '-en.html']);
    document.querySelector('.language-select')?.addEventListener('change', event => {
        if (allowed.includes(event.target.value)) location.href = event.target.value;
    });
}
