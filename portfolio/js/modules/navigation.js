import { initNavigationMenu } from './navigation-menu.js';

export function initNavigation() {
    initNavigationMenu();
    // Les anciens liens partagés vers les sections restent utilisables.
    const page = location.pathname.split('/').pop() || 'index.html';
    if (!['index.html', 'index-en.html'].includes(page)) return;
    const section = location.hash.slice(1);
    if (['projects', 'skills', 'contact'].includes(section)) {
        const suffix = document.documentElement.lang === 'en' ? '-en' : '';
        location.replace(section + suffix + '.html');
    }
}
