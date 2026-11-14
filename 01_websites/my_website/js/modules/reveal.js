/*
 * Reveal on scroll: the content of each page section, except the first,
 * fades in while rising by a few pixels as it enters the screen.
 * The section background stays displayed: the red of the page does not show through under a near-black background.
 * Without JavaScript or with reduced motion, everything stays displayed from the start.
 */


/*
 * The section appears when its top goes past 90% of the screen height.
 * A displayed section stays so: unobserve stops watching it.
 */
function revealOnScroll(parts) {
    const observer = new IntersectionObserver(entries => {
        for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            entry.target.classList.add("reveal--visible");
            observer.unobserve(entry.target);
        }
    }, { rootMargin: "0px 0px -10% 0px" });
    parts.forEach(part => observer.observe(part));
}


/*
 * The first section is already on screen at opening: it is not animated.
 * Each section block (title, text, timeline, wheel...) appears separately.
 */
export function initReveal() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const parts = document.querySelectorAll("main > section:not(:first-of-type) > *");
    parts.forEach(part => part.classList.add("reveal"));
    revealOnScroll(parts);
}
